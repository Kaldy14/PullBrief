"use client";

import type { FileDiffOptions, SelectedLineRange } from "@pierre/diffs";
import type { DiffLineAnnotation } from "@pierre/diffs/react";
import { PatchDiff } from "@pierre/diffs/react";
import {
  ArrowUpRight,
  Bot,
  Circle,
  CircleCheck,
  FileCode2,
  ListChecks,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  PanelBottomOpen,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Wordmark } from "@/components/brand/wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { GitHubWritebackView } from "@/lib/github/writeback";
import type { ReportRecommendation, ReportRankedFile, RiskLevel } from "@/lib/reports/types";
import type { ReviewDraftView } from "@/lib/review-drafts/service";
import { gitHubSideToPierre, sideToGitHub, type WorkbenchDiffFile } from "@/lib/review-workbench/diffs";
import { cn } from "@/lib/utils";

type ReviewWorkbenchRecord = {
  id: string;
  owner: string;
  repo: string;
  number: number;
  headSha: string;
  reportUrl: string;
  githubUrl: string;
  title: string;
  authorLogin: string;
  baseRef: string;
  headRef: string;
  recommendation: ReportRecommendation;
  summary: string;
  blockingIssues: string[];
  rankedFiles: ReportRankedFile[];
  openQuestions: string[];
};

type AiNote = {
  id: string;
  path: string;
  body: string;
  side: "LEFT" | "RIGHT";
  line: number | null;
  startLine: number | null;
  startSide: "LEFT" | "RIGHT" | null;
  source: "manual" | "ai_suggested";
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type DiffSelectionContext = {
  path: string;
  range: SelectedLineRange | null;
  selectedText: string | null;
  label: string;
};

type DiffContextMenuState = {
  x: number;
  y: number;
  context: DiffSelectionContext;
};

type AiPopoverMode = "explain" | "ask" | "note";

type AiPopoverState = {
  x: number;
  y: number;
  mode: AiPopoverMode;
  context: DiffSelectionContext;
  answer: string | null;
  error: string | null;
  loading: boolean;
  input: string;
};

type ReviewWorkbenchProps = {
  record: ReviewWorkbenchRecord;
  files: WorkbenchDiffFile[];
  patchWarning: string | null;
  initialDraft: ReviewDraftView | null;
  initialWritebacks: GitHubWritebackView[];
  canSubmit: boolean;
};

type AnnotationMetadata = {
  body: string;
  source: "manual" | "ai_suggested";
};

const riskVariant: Record<RiskLevel, "riskHigh" | "riskMed" | "riskLow"> = {
  high: "riskHigh",
  medium: "riskMed",
  low: "riskLow",
};

const decisionVariant: Record<ReportRecommendation, "riskHigh" | "riskMed" | "accent" | "outline"> = {
  approve: "accent",
  comment: "outline",
  request_changes: "riskHigh",
  review_carefully: "riskMed",
};

export function ReviewWorkbench({ record, files, patchWarning, initialDraft, canSubmit }: ReviewWorkbenchProps) {
  const rankedPaths = useMemo(() => new Set(record.rankedFiles.map((file) => file.path)), [record.rankedFiles]);
  const sortedFiles = useMemo(() => {
    const rankByPath = new Map(record.rankedFiles.map((file) => [file.path, file.rank]));
    return [...files].sort((a, b) => (rankByPath.get(a.path) ?? 999) - (rankByPath.get(b.path) ?? 999));
  }, [files, record.rankedFiles]);
  const [selectedPath, setSelectedPath] = useState(sortedFiles[0]?.path || "");
  const [notes, setNotes] = useState<AiNote[]>(initialDraft?.comments || []);
  const [selectedLines, setSelectedLines] = useState<SelectedLineRange | null>(null);
  const [viewedPaths, setViewedPaths] = useState<Set<string>>(() => readViewedPaths(record.id));
  const [saveState, setSaveState] = useState<"clean" | "dirty" | "saving" | "saved" | "error">("clean");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<DiffContextMenuState | null>(null);
  const [aiPopover, setAiPopover] = useState<AiPopoverState | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<"selection" | "notes">("selection");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const diffSurfaceRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedFile = sortedFiles.find((file) => file.path === selectedPath) || sortedFiles[0] || null;
  const rankedFile = record.rankedFiles.find((file) => file.path === selectedFile?.path) || null;
  const viewedCount = sortedFiles.filter((file) => viewedPaths.has(file.path)).length;
  const currentPayload = useMemo(() => reviewPayload({ body: buildNotesBody(record, notes), notes }), [notes, record]);
  const serializedPayload = useMemo(() => JSON.stringify(currentPayload), [currentPayload]);
  const lastSavedPayloadRef = useRef(JSON.stringify(reviewPayload({
    body: initialDraft?.body || buildNotesBody(record, initialDraft?.comments || []),
    notes: initialDraft?.comments || [],
  })));
  const fileNotes = useMemo(
    () => selectedFile ? notes.filter((note) => note.path === selectedFile.path) : [],
    [notes, selectedFile],
  );
  const annotations = useMemo<DiffLineAnnotation<AnnotationMetadata>[]>(() => fileNotes
    .filter((note) => note.line !== null)
    .map((note) => ({
      side: gitHubSideToPierre(note.side),
      lineNumber: note.line ?? 1,
      metadata: { body: note.body, source: note.source },
    })), [fileNotes]);
  const diffOptions = useMemo<FileDiffOptions<AnnotationMetadata>>(() => ({
    theme: "pierre-dark",
    themeType: "dark",
    diffStyle: "split",
    diffIndicators: "bars",
    overflow: "wrap",
    lineDiffType: "word-alt",
    hunkSeparators: "line-info-basic",
    lineHoverHighlight: "both",
    enableLineSelection: canSubmit,
    onLineSelected: setSelectedLines,
    onLineNumberClick: (props) => setSelectedLines({
      start: props.lineNumber,
      end: props.lineNumber,
      side: props.annotationSide,
      endSide: props.annotationSide,
    }),
    unsafeCSS: `
      pre[data-diffs] { font-size: 12px; line-height: 1.58; }
      [data-diffs-header] { border-radius: 12px 12px 0 0; }
    `,
  }), [canSubmit]);

  const saveNotes = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!canSubmit) {
      return null;
    }

    setSaveState("saving");

    if (!options.silent) {
      setStatusMessage(null);
    }

    const response = await fetch(`/api/reports/${record.id}/review-draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: serializedPayload,
    });

    if (!response.ok) {
      const error = await responseError(response);
      setSaveState("error");
      setStatusMessage(error);
      return null;
    }

    const payload = await response.json() as { draft: ReviewDraftView };
    lastSavedPayloadRef.current = JSON.stringify(reviewPayload({ body: payload.draft.body, notes: payload.draft.comments }));
    setNotes(payload.draft.comments);
    setSaveState("saved");

    if (!options.silent) {
      setStatusMessage("AI notes saved.");
    }

    return payload.draft;
  }, [canSubmit, record.id, serializedPayload]);

  useEffect(() => {
    window.localStorage.setItem(viewedStorageKey(record.id), JSON.stringify(Array.from(viewedPaths)));
  }, [record.id, viewedPaths]);

  useEffect(() => {
    if (!canSubmit) {
      return;
    }

    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    if (serializedPayload === lastSavedPayloadRef.current) {
      return;
    }

    setSaveState("dirty");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void saveNotes({ silent: true });
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [canSubmit, saveNotes, serializedPayload]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
        setAiPopover(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function toggleViewed(path: string) {
    setViewedPaths((current) => {
      const next = new Set(current);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  }

  function addAiNoteFromContext(input: {
    context: DiffSelectionContext;
    body: string;
    source?: "manual" | "ai_suggested";
    openQueue?: boolean;
  }) {
    const text = input.body.trim();

    if (!text) {
      setStatusMessage("Write a note first.");
      return;
    }

    const anchor = anchorFromSelection(input.context.range);
    const nextNote: AiNote = {
      id: `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      path: input.context.path,
      body: text,
      side: anchor.side,
      line: anchor.line,
      startLine: anchor.startLine,
      startSide: anchor.startSide,
      source: input.source || "manual",
    };

    setNotes((current) => [...current, nextNote]);
    setAiPopover(null);

    if (input.openQueue) {
      setNotesOpen(true);
    }

    setStatusMessage("Saved private note.");
  }

  function addAiNote(source: "manual" | "ai_suggested" = "manual", bodyOverride?: string) {
    if (!selectedFile) {
      return;
    }

    addAiNoteFromContext({
      context: buildDiffSelectionContext({
        file: selectedFile,
        range: selectedLines,
        selectedText: null,
      }),
      body: bodyOverride || "",
      source,
      openQueue: true,
    });
  }

  function openSelectionThread(context: DiffSelectionContext, assistantAnswer?: string | null) {
    setSelectedPath(context.path);
    setSelectedLines(context.range);
    setChatMode("selection");
    setChatMessages(assistantAnswer ? [{ role: "assistant", content: assistantAnswer }] : []);
    setChatInput(defaultSelectionQuestion(context));
    setChatOpen(true);
    setAiPopover(null);
    setContextMenu(null);
  }

  async function synthesizeNotes() {
    if (notes.length === 0) {
      return;
    }

    const question = "Synthesize risks from my private PullBrief notes. Cluster related concerns, identify likely blockers, call out uncertainty, and tell me what to verify next.";
    const userMessage: ChatMessage = { role: "user", content: question };
    setNotesOpen(false);
    setChatMode("notes");
    setChatMessages([userMessage]);
    setChatInput("");
    setChatOpen(true);
    setAsking(true);
    setStatusMessage(null);

    try {
      const answer = await requestAiAnswer({
        question: buildChatPrompt({ mode: "notes", messages: [userMessage], notes, file: selectedFile, selection: selectedLines }),
        path: selectedFile?.path || null,
        selectedLine: selectedLines?.end || null,
      });
      setChatMessages((current) => [...current, { role: "assistant", content: answer }]);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "PullBrief could not synthesize notes.");
    } finally {
      setAsking(false);
    }
  }

  async function requestAiAnswer(input: { question: string; path: string | null; selectedLine: number | null }) {
    const response = await fetch(`/api/reports/${record.id}/ai/clarify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(await responseError(response));
    }

    const payload = await response.json() as { answer: string };
    return payload.answer;
  }

  async function sendChatMessage() {
    const trimmed = chatInput.trim();

    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    setAsking(true);
    setStatusMessage(null);

    try {
      const answer = await requestAiAnswer({
        question: buildChatPrompt({ mode: chatMode, messages: nextMessages, notes, file: selectedFile, selection: selectedLines }),
        path: selectedFile?.path || null,
        selectedLine: selectedLines?.end || null,
      });
      setChatMessages((current) => [...current, { role: "assistant", content: answer }]);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "PullBrief could not answer.");
    } finally {
      setAsking(false);
    }
  }

  function handleDiffContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (!selectedFile || !diffSurfaceRef.current) {
      return;
    }

    const selectedText = selectedTextInElement(diffSurfaceRef.current);
    const pointerRange = lineRangeFromEventPath(event.nativeEvent.composedPath());
    const range = selectedText && selectedLines ? selectedLines : pointerRange || selectedLines;

    if (!range && !selectedText) {
      return;
    }

    event.preventDefault();
    const context = buildDiffSelectionContext({ file: selectedFile, range, selectedText });
    setSelectedLines(range);
    setContextMenu({ ...clampFloatingPoint(event.clientX, event.clientY, 240, 160), context });
    setAiPopover(null);
  }

  async function runPopoverExplain(context: DiffSelectionContext, point: { x: number; y: number }) {
    const base: AiPopoverState = {
      ...point,
      mode: "explain",
      context,
      answer: null,
      error: null,
      loading: true,
      input: "",
    };
    setAiPopover(base);
    setContextMenu(null);
    setStatusMessage(null);

    try {
      const answer = await requestAiAnswer({
        question: buildSelectionPrompt({ context, intent: "explain" }),
        path: context.path,
        selectedLine: context.range?.end || null,
      });
      setAiPopover((current) => current && current.context === context ? { ...current, answer, loading: false } : current);
    } catch (error) {
      setAiPopover((current) => current && current.context === context
        ? { ...current, error: error instanceof Error ? error.message : "PullBrief could not explain this selection.", loading: false }
        : current);
    }
  }

  function openPromptedPopover(context: DiffSelectionContext, point: { x: number; y: number }) {
    setAiPopover({
      ...point,
      mode: "ask",
      context,
      answer: null,
      error: null,
      loading: false,
      input: "",
    });
    setContextMenu(null);
  }

  function openNotePopover(context: DiffSelectionContext, point: { x: number; y: number }) {
    setAiPopover({
      ...point,
      mode: "note",
      context,
      answer: null,
      error: null,
      loading: false,
      input: "",
    });
    setContextMenu(null);
  }

  async function submitPopoverInstruction(input: string) {
    if (!aiPopover || aiPopover.mode !== "ask") {
      return;
    }

    const trimmed = input.trim();

    if (!trimmed) {
      return;
    }

    const context = aiPopover.context;
    setAiPopover((current) => current ? { ...current, loading: true, error: null, input: trimmed } : current);
    setStatusMessage(null);

    try {
      const answer = await requestAiAnswer({
        question: buildSelectionPrompt({ context, intent: "instruction", instruction: trimmed }),
        path: context.path,
        selectedLine: context.range?.end || null,
      });
      setAiPopover((current) => current && current.context === context ? { ...current, answer, loading: false } : current);
    } catch (error) {
      setAiPopover((current) => current && current.context === context
        ? { ...current, error: error instanceof Error ? error.message : "PullBrief could not answer.", loading: false }
        : current);
    }
  }

  function savePopoverNote(input: string) {
    if (!aiPopover) {
      return;
    }

    addAiNoteFromContext({ context: aiPopover.context, body: input, source: "manual", openQueue: true });
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Wordmark />
            <Separator orientation="vertical" className="hidden h-5 md:block" />
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-muted-foreground tabular">
                {record.owner}/{record.repo} <span className="text-border-strong">·</span> #{record.number} <span className="text-border-strong">·</span> @{record.authorLogin}
              </p>
              <h1 className="truncate text-sm font-medium text-foreground">{record.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-border bg-subtle/45 px-2 py-1 font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular md:inline-flex">
              {draftStatusLabel(saveState)}
            </span>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={record.reportUrl}>Report</Link>} />
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={record.githubUrl} target="_blank" rel="noreferrer">GitHub <ArrowUpRight className="size-3" /></a>} />
          </div>
        </div>
      </header>

      <main className="grid min-h-[calc(100dvh-57px)] grid-cols-1 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-subtle/25 p-4 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-2">
            <Badge variant={decisionVariant[record.recommendation]}>{record.recommendation.replace("_", " ")}</Badge>
            <span className="font-mono text-2xs uppercase text-muted-foreground tabular">{record.headSha.slice(0, 7)}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{record.summary}</p>

          {record.blockingIssues.length > 0 ? (
            <div className="mt-4 rounded-lg border border-risk-high/30 bg-risk-high/10 p-3 text-sm text-risk-high">
              <div className="flex items-center gap-2 font-medium"><ShieldAlert className="size-4" /> Blocking issues</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {record.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            </div>
          ) : null}

          <Separator className="my-5" />
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-2xs font-medium uppercase tracking-[0.1em] text-muted-foreground tabular">Files</p>
            <span className="font-mono text-2xs text-muted-foreground tabular">{viewedCount}/{sortedFiles.length} viewed</span>
          </div>
          <ol className="mt-3 space-y-1.5">
            {sortedFiles.map((file) => {
              const rank = record.rankedFiles.find((ranked) => ranked.path === file.path);
              const active = file.path === selectedFile?.path;
              const viewed = viewedPaths.has(file.path);
              return (
                <li key={file.path}>
                  <div className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                    viewed ? "opacity-60" : null,
                  )}>
                    <button
                      type="button"
                      onClick={() => toggleViewed(file.path)}
                      className="shrink-0 text-muted-foreground hover:text-primary"
                      aria-label={viewed ? `Mark ${file.path} unviewed` : `Mark ${file.path} viewed`}
                    >
                      {viewed ? <CircleCheck className="size-4" /> : <Circle className="size-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPath(file.path);
                        setSelectedLines(null);
                        setContextMenu(null);
                        setAiPopover(null);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                    >
                      <FileCode2 className="size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{file.path}</span>
                      {rank ? <Badge variant={riskVariant[rank.riskLevel]}>{rank.rank}</Badge> : null}
                      {!rankedPaths.has(file.path) ? <span className="text-2xs text-muted-foreground">unranked</span> : null}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="min-w-0 bg-background">
          {selectedFile ? (
            <div className="p-4 md:p-6">
              <div className="mb-4 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground tabular">Diff review</p>
                    <h2 className="mt-1 truncate font-display text-xl font-medium text-foreground">{selectedFile.path}</h2>
                    {rankedFile ? <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{rankedFile.summary}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">+{selectedFile.additions} −{selectedFile.deletions}</Badge>
                    <Badge variant={selectedFile.patchSource === "github" ? "accent" : "outline"}>{selectedFile.patchSource}</Badge>
                    <Button type="button" size="sm" variant="outline" onClick={() => toggleViewed(selectedFile.path)}>
                      {viewedPaths.has(selectedFile.path) ? <CircleCheck className="size-3.5" /> : <Circle className="size-3.5" />}
                      {viewedPaths.has(selectedFile.path) ? "Viewed" : "Mark viewed"}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground tabular">Diff actions</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedLines ? selectionLabel(selectedLines) : "Select code or a diff line, then right-click for AI actions."}
                    </p>
                  </div>
                  {notes.length > 0 ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setNotesOpen(true)}>
                      <ListChecks className="size-3.5" /> AI notes ({notes.length})
                    </Button>
                  ) : null}
                </div>
              </div>

              {patchWarning ? (
                <div className="mb-4 rounded-lg border border-risk-med/35 bg-risk-med/10 p-3 text-sm text-risk-med">{patchWarning}</div>
              ) : null}

              {selectedFile.patch ? (
                <div
                  ref={diffSurfaceRef}
                  onContextMenu={handleDiffContextMenu}
                  onClick={() => setContextMenu(null)}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <PatchDiff<AnnotationMetadata>
                    patch={selectedFile.patch}
                    options={diffOptions}
                    selectedLines={selectedLines}
                    lineAnnotations={annotations}
                    renderAnnotation={(annotation) => (
                      <div className="rounded-md border border-border bg-background/95 p-2 text-xs text-foreground shadow-sm">
                        <p className="font-mono text-2xs uppercase text-muted-foreground tabular">AI note</p>
                        <p className="mt-1 whitespace-pre-wrap">{annotation.metadata.body}</p>
                      </div>
                    )}
                    disableWorkerPool
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <p className="font-medium text-foreground">Patch unavailable</p>
                  <p className="mt-2 text-sm text-muted-foreground">The stored patch was pruned or GitHub did not return a renderable patch for this file.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-muted-foreground">No changed files found.</div>
          )}
        </section>
      </main>

      {notes.length > 0 ? (
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-[0_16px_40px_-24px_oklch(0_0_0/0.85)] hover:bg-subtle"
        >
          <PanelBottomOpen className="size-4" /> AI notes ({notes.length})
        </button>
      ) : null}

      {statusMessage ? (
        <div className={cn(
          "fixed bottom-4 left-1/2 z-40 max-w-md -translate-x-1/2 rounded-lg border px-3 py-2 text-sm shadow-[0_16px_40px_-24px_oklch(0_0_0/0.85)]",
          saveState === "error" ? "border-risk-high/35 bg-risk-high/10 text-risk-high" : "border-border bg-card text-muted-foreground",
        )}>
          {statusMessage}
        </div>
      ) : null}

      {contextMenu ? (
        <DiffContextMenu
          state={contextMenu}
          canSaveNote={canSubmit}
          onClose={() => setContextMenu(null)}
          onExplain={(context, point) => void runPopoverExplain(context, point)}
          onAsk={openPromptedPopover}
          onNote={openNotePopover}
        />
      ) : null}

      {aiPopover ? (
        <AiAnswerPopover
          state={aiPopover}
          canSaveNote={canSubmit}
          onClose={() => setAiPopover(null)}
          onInputChange={(value) => setAiPopover((current) => current ? { ...current, input: value } : current)}
          onSubmitInstruction={(value) => void submitPopoverInstruction(value)}
          onSaveNote={savePopoverNote}
          onSaveAnswer={(answer) => addAiNoteFromContext({ context: aiPopover.context, body: answer, source: "ai_suggested", openQueue: true })}
          onFollowUp={(answer) => openSelectionThread(aiPopover.context, answer)}
        />
      ) : null}

      {chatOpen ? (
        <AiThreadDrawer
          mode={chatMode}
          file={selectedFile}
          selection={selectedLines}
          notes={notes}
          messages={chatMessages}
          input={chatInput}
          asking={asking}
          onInputChange={setChatInput}
          onSend={sendChatMessage}
          onClose={() => setChatOpen(false)}
          onSaveAssistantNote={(content) => addAiNote("ai_suggested", content)}
        />
      ) : null}

      {notesOpen ? (
        <AiNotesDrawer
          notes={notes}
          saveState={saveState}
          onClose={() => setNotesOpen(false)}
          onRemove={(id) => setNotes((current) => current.filter((note) => note.id !== id))}
          onSave={() => void saveNotes()}
          onDiscuss={() => void synthesizeNotes()}
        />
      ) : null}
    </div>
  );
}

function DiffContextMenu({ state, canSaveNote, onClose, onExplain, onAsk, onNote }: {
  state: DiffContextMenuState;
  canSaveNote: boolean;
  onClose: () => void;
  onExplain: (context: DiffSelectionContext, point: { x: number; y: number }) => void;
  onAsk: (context: DiffSelectionContext, point: { x: number; y: number }) => void;
  onNote: (context: DiffSelectionContext, point: { x: number; y: number }) => void;
}) {
  const popoverPoint = clampFloatingPoint(state.x + 8, state.y + 8, 420, 460);

  return (
    <div
      role="menu"
      aria-label="Diff AI actions"
      className="fixed z-50 w-60 overflow-hidden rounded-lg border border-border bg-card p-1 text-sm shadow-[0_24px_70px_-36px_oklch(0_0_0/0.9)]"
      style={{ left: state.x, top: state.y }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-border px-2 py-2">
        <p className="truncate font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground tabular">{state.context.path}</p>
        <p className="mt-1 text-xs text-muted-foreground">{state.context.label}</p>
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={() => onExplain(state.context, popoverPoint)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-foreground hover:bg-subtle"
      >
        <Bot className="size-4 text-primary" /> Explain selection
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onAsk(state.context, popoverPoint)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-foreground hover:bg-subtle"
      >
        <MessageSquare className="size-4 text-muted-foreground" /> Ask with instruction
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!canSaveNote}
        onClick={() => onNote(state.context, popoverPoint)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MessageSquarePlus className="size-4 text-muted-foreground" /> Save private note
      </button>
      <button
        type="button"
        onClick={onClose}
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-subtle hover:text-foreground"
      >
        <X className="size-3.5" /> Close
      </button>
    </div>
  );
}

function AiAnswerPopover({
  state,
  canSaveNote,
  onClose,
  onInputChange,
  onSubmitInstruction,
  onSaveNote,
  onSaveAnswer,
  onFollowUp,
}: {
  state: AiPopoverState;
  canSaveNote: boolean;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onSubmitInstruction: (value: string) => void;
  onSaveNote: (value: string) => void;
  onSaveAnswer: (answer: string) => void;
  onFollowUp: (answer?: string | null) => void;
}) {
  const title = state.mode === "note"
    ? "Private note"
    : state.mode === "ask" ? "Ask about selection" : "Explanation";

  return (
    <div
      role="dialog"
      aria-label={title}
      className="fixed z-50 w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border bg-card shadow-[0_24px_80px_-36px_oklch(0_0_0/0.9)]"
      style={{ left: state.x, top: state.y }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-3">
        <div className="min-w-0">
          <p className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground tabular">{title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{state.context.path} · {state.context.label}</p>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close AI popover">
          <X className="size-4" />
        </button>
      </div>

      <div className="max-h-[min(34rem,calc(100dvh-8rem))] overflow-auto p-3">
        {state.context.selectedText ? (
          <pre className="mb-3 max-h-28 overflow-auto rounded-lg border border-border bg-background/70 p-2 font-mono text-xs leading-5 text-muted-foreground whitespace-pre-wrap">
            {state.context.selectedText}
          </pre>
        ) : null}

        {state.mode === "ask" || state.mode === "note" ? (
          <div className="space-y-2">
            <textarea
              value={state.input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (state.mode === "ask" && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  onSubmitInstruction(state.input);
                }
              }}
              autoFocus
              rows={state.mode === "note" ? 5 : 3}
              placeholder={state.mode === "note"
                ? "Write a private note for AI. This is not posted to GitHub."
                : "Ask a focused question, e.g. what can break here, how should I test this, why is this risky?"}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              {state.mode === "note" ? (
                <Button type="button" size="sm" onClick={() => onSaveNote(state.input)} disabled={!state.input.trim() || !canSaveNote}>
                  <MessageSquarePlus className="size-3.5" /> Save note
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={() => onSubmitInstruction(state.input)} disabled={!state.input.trim() || state.loading}>
                  {state.loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Ask
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {state.loading ? (
          <div className="mt-3 rounded-lg border border-border bg-background/60 p-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> PullBrief is reading the selected diff.</div>
          </div>
        ) : null}

        {state.error ? (
          <div className="mt-3 rounded-lg border border-risk-high/35 bg-risk-high/10 p-3 text-sm text-risk-high">
            {state.error}
          </div>
        ) : null}

        {state.answer ? (
          <div className="mt-3 rounded-lg border border-primary/25 bg-primary/10 p-3">
            <MarkdownPreview markdown={state.answer} />
          </div>
        ) : null}
      </div>

      {state.answer ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onFollowUp(state.answer)}>
            <MessageSquare className="size-3.5" /> Ask follow-up
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onSaveAnswer(state.answer || "")} disabled={!canSaveNote}>
            <MessageSquarePlus className="size-3.5" /> Save as note
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AiThreadDrawer({
  mode,
  file,
  selection,
  notes,
  messages,
  input,
  asking,
  onInputChange,
  onSend,
  onClose,
  onSaveAssistantNote,
}: {
  mode: "selection" | "notes";
  file: WorkbenchDiffFile | null;
  selection: SelectedLineRange | null;
  notes: AiNote[];
  messages: ChatMessage[];
  input: string;
  asking: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  onSaveAssistantNote: (content: string) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card shadow-[0_-24px_80px_-44px_oklch(0_0_0/0.9)]" role="dialog" aria-modal="false">
      <div className="mx-auto flex max-h-[min(680px,calc(100dvh-3rem))] w-full max-w-[92rem] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground tabular">AI thread</p>
            <h2 className="mt-1 text-lg font-medium text-foreground">{mode === "notes" ? `Risk synthesis from ${notes.length} notes` : file?.path || "Selection"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{mode === "notes" ? "Private PullBrief notes, synthesized before anything goes to GitHub." : selectionLabel(selection)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close AI thread">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
          {messages.length === 0 ? (
            <div className="rounded-lg border border-border bg-background/60 p-4 text-sm text-muted-foreground">
              Ask a follow-up about the selected code or synthesize queued notes. This thread is private to PullBrief.
            </div>
          ) : null}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={cn(
              "rounded-lg border p-3 text-sm",
              message.role === "user" ? "ml-10 border-border bg-background text-foreground" : "mr-10 border-primary/25 bg-primary/10 text-foreground",
            )}>
              <p className="mb-1 font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground tabular">{message.role}</p>
              <MarkdownPreview markdown={message.content} />
              {message.role === "assistant" ? (
                <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => onSaveAssistantNote(message.content)}>
                  Save as AI note
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="border-t border-border p-4">
          <textarea
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                onSend();
              }
            }}
            rows={3}
            placeholder="Ask about the selected code or queued notes..."
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">⌘ Enter sends</p>
            <Button type="button" onClick={onSend} disabled={asking || !input.trim()}>
              {asking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiNotesDrawer({ notes, saveState, onClose, onRemove, onSave, onDiscuss }: {
  notes: AiNote[];
  saveState: "clean" | "dirty" | "saving" | "saved" | "error";
  onClose: () => void;
  onRemove: (id: string) => void;
  onSave: () => void;
  onDiscuss: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card shadow-[0_-24px_80px_-44px_oklch(0_0_0/0.9)]">
      <div className="mx-auto max-w-[92rem] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground tabular">AI note queue</p>
            <h2 className="mt-1 text-lg font-medium text-foreground">{notes.length} notes for later discussion</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-background px-2 py-1 font-mono text-2xs uppercase text-muted-foreground tabular">{draftStatusLabel(saveState)}</span>
            <Button type="button" variant="outline" onClick={onSave}>Save</Button>
            <Button type="button" onClick={onDiscuss} disabled={notes.length === 0}><Bot className="size-4" /> Synthesize risks</Button>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close notes drawer"><X className="size-4" /></button>
          </div>
        </div>
        <ol className="mt-4 grid max-h-72 gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-border bg-background/70 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate font-mono text-2xs uppercase text-muted-foreground tabular">{note.path}:{note.line ?? "file"}</p>
                <button type="button" onClick={() => onRemove(note.id)} className="text-muted-foreground hover:text-risk-high" aria-label="Remove AI note">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-foreground/90">{note.body}</p>
            </li>
          ))}
          {notes.length === 0 ? <li className="text-sm text-muted-foreground">No notes yet. Select lines and add context for AI as you review.</li> : null}
        </ol>
      </div>
    </div>
  );
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div className="text-sm text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 leading-6 text-muted-foreground last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 text-muted-foreground">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 text-muted-foreground">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          code: ({ children }) => <code className="rounded bg-subtle px-1 py-0.5 font-mono text-xs text-foreground">{children}</code>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function buildDiffSelectionContext(input: {
  file: WorkbenchDiffFile;
  range: SelectedLineRange | null;
  selectedText: string | null;
}): DiffSelectionContext {
  const selectedText = compactSelectionText(input.selectedText);
  const label = selectedText
    ? `${selectionLabel(input.range)} · ${selectedText.length} selected chars`
    : selectionLabel(input.range);

  return {
    path: input.file.path,
    range: input.range,
    selectedText,
    label,
  };
}

function selectedTextInElement(root: HTMLElement) {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (!nodeBelongsToElementOrShadow(root, range.commonAncestorContainer)) {
    return null;
  }

  return selection.toString().trim() || null;
}

function lineRangeFromEventPath(path: EventTarget[]): SelectedLineRange | null {
  for (const target of path) {
    if (!(target instanceof HTMLElement)) {
      continue;
    }

    const lineValue = target.getAttribute("data-line") || target.getAttribute("data-column-number");

    if (!lineValue) {
      continue;
    }

    const line = Number.parseInt(lineValue, 10);

    if (Number.isNaN(line)) {
      return null;
    }

    const side = pierreSideFromElement(target);
    return { start: line, end: line, side, endSide: side };
  }

  return null;
}

function nodeBelongsToElementOrShadow(root: HTMLElement, node: Node) {
  if (root.contains(node)) {
    return true;
  }

  const nodeRoot = node.getRootNode();
  return nodeRoot instanceof ShadowRoot && nodeRoot.host instanceof Node && root.contains(nodeRoot.host);
}

function pierreSideFromElement(element: HTMLElement): SelectedLineRange["side"] {
  const lineType = element.getAttribute("data-line-type");

  if (lineType === "change-deletion") {
    return "deletions";
  }

  if (lineType === "change-addition") {
    return "additions";
  }

  const codeElement = element.closest("[data-code]");
  return codeElement instanceof HTMLElement && codeElement.hasAttribute("data-deletions") ? "deletions" : "additions";
}

function clampFloatingPoint(x: number, y: number, width: number, height: number) {
  const gutter = 12;

  if (typeof window === "undefined") {
    return { x, y };
  }

  return {
    x: Math.min(Math.max(gutter, x), Math.max(gutter, window.innerWidth - width - gutter)),
    y: Math.min(Math.max(gutter, y), Math.max(gutter, window.innerHeight - height - gutter)),
  };
}

function compactSelectionText(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const maxChars = 2_500;
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}\n[selection truncated]` : trimmed;
}

function buildSelectionPrompt(input: {
  context: DiffSelectionContext;
  intent: "explain" | "instruction";
  instruction?: string;
}) {
  return [
    input.intent === "explain"
      ? "Explain this selected diff code for a senior PR reviewer. Focus on what it does, why it matters to this PR, risks, and what to verify next."
      : "Answer my instruction about this selected diff code for a senior PR reviewer.",
    `File: ${input.context.path}`,
    `Selection: ${input.context.label}`,
    input.context.selectedText ? `Selected text:\n${input.context.selectedText}` : "Selected text: not available, use the selected diff line/range from context.",
    input.instruction ? `Reviewer instruction:\n${input.instruction}` : null,
  ].filter((part): part is string => Boolean(part)).join("\n\n");
}

function anchorFromSelection(selection: SelectedLineRange | null): Pick<AiNote, "side" | "line" | "startLine" | "startSide"> {
  if (!selection) {
    return { side: "RIGHT", line: null, startLine: null, startSide: null };
  }

  const side = sideToGitHub(selection.endSide || selection.side);
  const startSide = sideToGitHub(selection.side);
  const startLine = Math.min(selection.start, selection.end);
  const endLine = Math.max(selection.start, selection.end);

  return {
    side,
    line: endLine,
    startLine: startLine === endLine ? null : startLine,
    startSide: startLine === endLine ? null : startSide,
  };
}

function selectionLabel(selection: SelectedLineRange | null) {
  if (!selection) {
    return "No diff line selected.";
  }

  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  const side = sideToGitHub(selection.endSide || selection.side);
  return start === end ? `${side} line ${end}` : `${side} lines ${start}-${end}`;
}

function defaultSelectionQuestion(context: DiffSelectionContext) {
  return `Help me understand this change in ${context.path} at ${context.label}. What should I verify before approving?`;
}

function buildChatPrompt(input: {
  mode: "selection" | "notes";
  messages: ChatMessage[];
  notes: AiNote[];
  file: WorkbenchDiffFile | null;
  selection: SelectedLineRange | null;
}) {
  return [
    input.mode === "notes"
      ? "I collected private reviewer notes while reading the PR. Discuss them with me."
      : "I am asking about the current selected diff context.",
    input.file ? `Selected file: ${input.file.path}` : "Selected file: none",
    `Selected lines: ${selectionLabel(input.selection)}`,
    input.notes.length > 0
      ? `Private reviewer notes:\n${input.notes.map((note, index) => `${index + 1}. ${note.path}:${note.line ?? "file"} ${note.body}`).join("\n")}`
      : "Private reviewer notes: none",
    "Conversation so far:",
    input.messages.map((message) => `${message.role}: ${message.content}`).join("\n"),
  ].join("\n\n");
}

function buildNotesBody(record: ReviewWorkbenchRecord, notes: AiNote[]) {
  return [
    "## PullBrief private AI notes",
    "",
    `PR: ${record.owner}/${record.repo}#${record.number}`,
    "",
    ...notes.map((note, index) => `${index + 1}. ${note.path}:${note.line ?? "file"} ${note.body}`),
  ].join("\n");
}

function reviewPayload(input: { body: string; notes: AiNote[] }) {
  return {
    reviewEvent: "COMMENT" as const,
    body: input.body,
    comments: input.notes.map((note) => ({
      path: note.path,
      body: note.body,
      side: note.side,
      line: note.line,
      startLine: note.startLine,
      startSide: note.startSide,
      source: note.source,
    })),
  };
}

function draftStatusLabel(status: "clean" | "dirty" | "saving" | "saved" | "error") {
  if (status === "dirty") {
    return "Unsaved notes";
  }

  if (status === "saving") {
    return "Saving";
  }

  if (status === "saved") {
    return "Autosaved";
  }

  if (status === "error") {
    return "Save failed";
  }

  return "Notes saved";
}

function readViewedPaths(reportId: string) {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  const stored = window.localStorage.getItem(viewedStorageKey(reportId));

  if (!stored) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function viewedStorageKey(reportId: string) {
  return `pullbrief:viewed-files:${reportId}`;
}

async function responseError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || `Request failed with HTTP ${response.status}.`;
}

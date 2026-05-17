import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { prReports, pullRequests, repositories, reviewDraftComments, reviewDrafts } from "@/db/schema";
import { publishPullRequestReview, type PullRequestReviewCommentInput, type PullRequestReviewEvent } from "@/lib/github/writeback";
import type { ReportRecord } from "@/lib/reports/types";

export type ReviewDraftCommentInput = {
  path: string;
  body: string;
  side: "LEFT" | "RIGHT";
  line: number | null;
  startLine?: number | null;
  startSide?: "LEFT" | "RIGHT" | null;
  source?: "manual" | "ai_suggested";
};

export type ReviewDraftInput = {
  reportId: string;
  tenantId: string;
  userId: string;
  reviewEvent: PullRequestReviewEvent;
  body: string;
  comments: ReviewDraftCommentInput[];
};

export type ReviewDraftView = {
  id: string;
  status: "draft" | "submitted" | "abandoned";
  reviewEvent: PullRequestReviewEvent;
  body: string;
  githubHtmlUrl: string | null;
  submittedAt: string | null;
  comments: ReviewDraftCommentView[];
  updatedAt: string;
};

export type ReviewDraftCommentView = {
  id: string;
  path: string;
  body: string;
  side: "LEFT" | "RIGHT";
  line: number | null;
  startLine: number | null;
  startSide: "LEFT" | "RIGHT" | null;
  source: "manual" | "ai_suggested";
};

export async function getReviewDraftForUser(input: {
  reportId: string;
  tenantId: string;
  userId: string;
}): Promise<ReviewDraftView | null> {
  const [draft] = await db
    .select()
    .from(reviewDrafts)
    .where(and(
      eq(reviewDrafts.reportId, input.reportId),
      eq(reviewDrafts.tenantId, input.tenantId),
      eq(reviewDrafts.userId, input.userId),
    ))
    .limit(1);

  if (!draft) {
    return null;
  }

  const comments = await db
    .select()
    .from(reviewDraftComments)
    .where(and(eq(reviewDraftComments.draftId, draft.id), ne(reviewDraftComments.status, "deleted")))
    .orderBy(asc(reviewDraftComments.createdAt));

  return {
    id: draft.id,
    status: draft.status,
    reviewEvent: draft.reviewEvent,
    body: draft.body,
    githubHtmlUrl: draft.githubHtmlUrl,
    submittedAt: draft.submittedAt?.toISOString() || null,
    updatedAt: draft.updatedAt.toISOString(),
    comments: comments.map((comment) => ({
      id: comment.id,
      path: comment.path,
      body: comment.body,
      side: comment.side,
      line: comment.line,
      startLine: comment.startLine,
      startSide: comment.startSide,
      source: comment.source,
    })),
  };
}

export async function saveReviewDraft(input: ReviewDraftInput): Promise<ReviewDraftView> {
  const links = await getReportLinksForDraft(input.reportId, input.tenantId);

  if (!links) {
    throw new Error("Report not found.");
  }

  const draftId = randomUUID();
  const now = new Date();
  const [draft] = await db
    .insert(reviewDrafts)
    .values({
      id: draftId,
      tenantId: input.tenantId,
      reportId: input.reportId,
      repositoryId: links.repositoryId,
      pullRequestId: links.pullRequestId,
      userId: input.userId,
      status: "draft",
      reviewEvent: input.reviewEvent,
      body: input.body,
      githubReviewId: null,
      githubNodeId: null,
      githubHtmlUrl: null,
      submittedAt: null,
    })
    .onConflictDoUpdate({
      target: [reviewDrafts.reportId, reviewDrafts.userId],
      set: {
        repositoryId: links.repositoryId,
        pullRequestId: links.pullRequestId,
        status: "draft",
        reviewEvent: input.reviewEvent,
        body: input.body,
        updatedAt: now,
      },
    })
    .returning();

  await db.delete(reviewDraftComments).where(eq(reviewDraftComments.draftId, draft.id));

  if (input.comments.length > 0) {
    await db.insert(reviewDraftComments).values(input.comments.map((comment) => ({
      id: randomUUID(),
      tenantId: input.tenantId,
      draftId: draft.id,
      path: comment.path,
      side: comment.side,
      line: comment.line,
      startLine: comment.startLine ?? null,
      startSide: comment.startSide ?? null,
      body: comment.body,
      source: comment.source ?? "manual",
      status: "draft" as const,
    })));
  }

  const saved = await getReviewDraftForUser(input);

  if (!saved) {
    throw new Error("Unable to reload saved review draft.");
  }

  return saved;
}

export async function submitReviewDraft(input: ReviewDraftInput & { record: ReportRecord }): Promise<ReviewDraftView> {
  const draft = await saveReviewDraft(input);
  const reviewComments = draft.comments
    .filter((comment) => comment.line !== null)
    .map((comment): PullRequestReviewCommentInput => ({
      path: comment.path,
      body: comment.body,
      line: comment.line ?? 1,
      side: comment.side,
      startLine: comment.startLine,
      startSide: comment.startSide,
    }));
  const result = await publishPullRequestReview(input.record, {
    event: input.reviewEvent,
    body: input.body,
    comments: reviewComments,
  });

  if (result.status !== "published") {
    throw new Error(result.errorMessage || "GitHub PR review publish failed.");
  }

  await db
    .update(reviewDrafts)
    .set({
      status: "submitted",
      githubReviewId: result.githubDatabaseId,
      githubHtmlUrl: result.htmlUrl,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(reviewDrafts.id, draft.id));

  const submitted = await getReviewDraftForUser(input);

  if (!submitted) {
    throw new Error("Unable to reload submitted review draft.");
  }

  return submitted;
}

async function getReportLinksForDraft(reportId: string, tenantId: string) {
  const [row] = await db
    .select({
      repositoryId: repositories.id,
      pullRequestId: pullRequests.id,
    })
    .from(prReports)
    .innerJoin(pullRequests, eq(prReports.pullRequestId, pullRequests.id))
    .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
    .where(and(eq(prReports.id, reportId), eq(prReports.tenantId, tenantId)))
    .limit(1);

  return row || null;
}

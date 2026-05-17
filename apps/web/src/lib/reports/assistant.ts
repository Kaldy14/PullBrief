import "server-only";

import { runPiPrint } from "@/lib/reports/generator";
import { buildAssistantContext, buildPullBriefAssistantPrompt } from "@/lib/reports/prompts";
import type { ReportRecord } from "@/lib/reports/types";

export async function answerPullBriefQuestion(input: {
  record: ReportRecord;
  question: string;
  path?: string | null;
  selectedLine?: number | null;
}): Promise<string> {
  if (process.env.PULLBRIEF_AI_BACKEND === "heuristic") {
    return heuristicAnswer(input);
  }

  const output = await runPiPrint({
    prompt: buildPullBriefAssistantPrompt(),
    stdin: JSON.stringify(buildAssistantContext(input), null, 2),
  });

  return output.stdout.trim() || "PullBrief did not return an answer.";
}

function heuristicAnswer(input: { question: string; path?: string | null }) {
  return [
    "Heuristic AI backend is enabled, so PullBrief did not call pi for this clarification.",
    "",
    input.path ? `Selected file: \`${input.path}\`.` : "No file was selected.",
    "",
    `Question: ${input.question}`,
    "",
    "Switch `PULLBRIEF_AI_BACKEND` back to pi for model-backed clarification.",
  ].join("\n");
}

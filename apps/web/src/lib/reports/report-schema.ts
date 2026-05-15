export const pullBriefReportJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: ["pullbrief.report.v1"] },
    generatedAt: { type: "string" },
    generator: {
      type: "object",
      additionalProperties: false,
      properties: {
        provider: { type: "string", enum: ["pi", "heuristic"] },
        model: { type: "string" },
        mode: { type: "string", enum: ["print-cli", "deterministic"] },
        warnings: { type: "array", items: { type: "string" } },
      },
      required: ["provider", "model", "mode", "warnings"],
    },
    prSummary: {
      type: "object",
      additionalProperties: false,
      properties: {
        intent: { type: "string" },
        businessImpact: { type: "string" },
        technicalImpact: { type: "string" },
        reviewerFocus: { type: "array", items: { type: "string" } },
      },
      required: ["intent", "businessImpact", "technicalImpact", "reviewerFocus"],
    },
    decision: {
      type: "object",
      additionalProperties: false,
      properties: {
        recommendation: {
          type: "string",
          enum: ["approve", "comment", "request_changes", "review_carefully"],
        },
        summary: { type: "string" },
        blockingIssues: { type: "array", items: { type: "string" } },
      },
      required: ["recommendation", "summary", "blockingIssues"],
    },
    riskAreas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          level: { type: "string", enum: ["low", "medium", "high"] },
          title: { type: "string" },
          reason: { type: "string" },
          files: { type: "array", items: { type: "string" } },
        },
        required: ["level", "title", "reason", "files"],
      },
    },
    changeGroups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          files: { type: "array", items: { type: "string" } },
          reviewNotes: { type: "array", items: { type: "string" } },
          riskLevel: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["title", "summary", "files", "reviewNotes", "riskLevel"],
      },
    },
    rankedFiles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string" },
          rank: { type: "integer" },
          reason: { type: "string" },
          summary: { type: "string" },
          riskLevel: { type: "string", enum: ["low", "medium", "high"] },
          reviewMode: { type: "string", enum: ["read", "check", "skim"] },
        },
        required: ["path", "rank", "reason", "summary", "riskLevel", "reviewMode"],
      },
    },
    verification: {
      type: "object",
      additionalProperties: false,
      properties: {
        suggestedCommands: { type: "array", items: { type: "string" } },
        manualChecks: { type: "array", items: { type: "string" } },
        missingTests: { type: "array", items: { type: "string" } },
      },
      required: ["suggestedCommands", "manualChecks", "missingTests"],
    },
    openQuestions: { type: "array", items: { type: "string" } },
  },
  required: [
    "schemaVersion",
    "generatedAt",
    "generator",
    "prSummary",
    "decision",
    "riskAreas",
    "changeGroups",
    "rankedFiles",
    "verification",
    "openQuestions",
  ],
} as const;

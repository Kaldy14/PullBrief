export type RiskLevel = "high" | "med" | "low";

export type RankedFile = {
  rank: number;
  path: string;
  added: number;
  removed: number;
  risk: RiskLevel;
  summary: string;
};

export type RiskArea = {
  level: RiskLevel;
  title: string;
  reason: string;
  files: string[];
};

export type ChangeGroup = {
  title: string;
  summary: string;
  files: string[];
};

export type SampleBrief = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  baseRef: string;
  headRef: string;
  headSha: string;
  filesChanged: number;
  added: number;
  removed: number;
  generatedAt: string;
  intent: string;
  decisionTrail: string;
  riskAreas: RiskArea[];
  changeGroups: ChangeGroup[];
  rankedFiles: RankedFile[];
  verification: string[];
  openQuestions: string[];
};

export const sampleBrief: SampleBrief = {
  owner: "acme",
  repo: "api",
  number: 1247,
  title: "feat: drizzle migration runner with rollback gating",
  author: "dlee",
  baseRef: "main",
  headRef: "feat/migrate-runner",
  headSha: "abc123f",
  filesChanged: 18,
  added: 642,
  removed: 91,
  generatedAt: "2026-05-13T17:42:00Z",
  intent:
    "Adds a Drizzle-based migration runner that executes schema changes inside a single write transaction and a new background worker that drains pending migrations on boot. A rollback gate refuses to apply a migration whose down-step has not been declared, which is the central safety change reviewers should evaluate.",
  decisionTrail:
    "The team moved migration execution from a manual dev script into the queue worker so schema drains happen on boot. To make that safe, they added a rollback gate and advisory lock instead of relying on reviewer discipline and runbook timing.",
  riskAreas: [
    {
      level: "high",
      title: "Write boundary expanded across module lines",
      reason:
        "drizzle.write() now wraps the migration runner and the queue processor's startup hook. A worker failure can leave the runner with an open transaction; the timeout and rollback path decide whether that closes cleanly.",
      files: ["schema/migrations.ts", "queue/worker.ts", "lib/drizzle/transaction.ts"],
    },
    {
      level: "med",
      title: "No declared rollback for two migrations",
      reason:
        "Two of the four new migrations ship without a down() implementation. The rollback gate is supposed to refuse to run these, but the gate only checks the file name pattern, not the export.",
      files: [
        "schema/migrations/20260512_add_audit_log.ts",
        "schema/migrations/20260513_index_brief_sha.ts",
      ],
    },
    {
      level: "low",
      title: "Background worker retry policy changed",
      reason:
        "Retry backoff dropped from 30s to 5s. Reasonable for a migration drain, but the operational contract belongs in CHANGELOG and the runbook.",
      files: ["queue/worker.ts", "docs/runbooks/queue.md"],
    },
  ],
  changeGroups: [
    {
      title: "Migration runner",
      summary:
        "Core change. Introduces MigrationRunner, the rollback gate, and the migration table schema. Two new migrations land at the same time as examples.",
      files: [
        "schema/migrations.ts",
        "schema/migrations/20260512_add_audit_log.ts",
        "schema/migrations/20260513_index_brief_sha.ts",
        "lib/drizzle/transaction.ts",
      ],
    },
    {
      title: "Queue integration",
      summary:
        "Wires the runner into the queue worker so migrations run on boot. New retry policy. Adds a queue-level lock so two workers cannot race the same migration.",
      files: ["queue/worker.ts", "queue/lock.ts", "queue/index.ts"],
    },
    {
      title: "API surface",
      summary:
        "Two new routes for inspecting migration state and triggering a manual drain. Both are admin-only and gated behind the existing role check.",
      files: ["api/router.ts", "api/admin/migrations.ts", "api/admin/__tests__/migrations.test.ts"],
    },
    {
      title: "Docs and runbooks",
      summary:
        "Updates the queue runbook with the new retry policy and adds a short section on how to declare a rollback. CHANGELOG entry included.",
      files: ["docs/runbooks/queue.md", "docs/migrations.md", "CHANGELOG.md"],
    },
  ],
  rankedFiles: [
    {
      rank: 1,
      path: "schema/migrations.ts",
      added: 142,
      removed: 8,
      risk: "high",
      summary:
        "MigrationRunner and the rollback gate. Primary semantic change; behavior hinges on runtime validation of down().",
    },
    {
      rank: 2,
      path: "queue/worker.ts",
      added: 89,
      removed: 22,
      risk: "high",
      summary:
        "Boot hook that drains migrations. New retry policy. The queue-level lock is the production race boundary for multi-worker deployments.",
    },
    {
      rank: 3,
      path: "lib/drizzle/transaction.ts",
      added: 44,
      removed: 6,
      risk: "high",
      summary:
        "drizzle.write() now accepts a nested transaction. Existing nested-write callers, audit and billing, are the blast radius.",
    },
    {
      rank: 4,
      path: "queue/lock.ts",
      added: 38,
      removed: 0,
      risk: "med",
      summary:
        "New advisory lock per migration name. Postgres LOCK_TIMEOUT default is 0; this sets 30s and changes the runbook contract.",
    },
    {
      rank: 5,
      path: "api/admin/migrations.ts",
      added: 64,
      removed: 0,
      risk: "med",
      summary:
        "Admin route returning the migration table and a drain endpoint. Auth check is reused from the existing admin router.",
    },
    {
      rank: 6,
      path: "schema/migrations/20260512_add_audit_log.ts",
      added: 31,
      removed: 0,
      risk: "med",
      summary:
        "New audit_log table. No down(); safe only if the rollback gate blocks it or the migration is marked terminal.",
    },
    {
      rank: 7,
      path: "schema/migrations/20260513_index_brief_sha.ts",
      added: 22,
      removed: 0,
      risk: "med",
      summary:
        "Index on pr_reports(head_sha). Concurrent index creation is not used, so the table takes a brief lock.",
    },
    {
      rank: 8,
      path: "queue/index.ts",
      added: 18,
      removed: 4,
      risk: "low",
      summary: "Exports the new lock and registers the migration drain on boot.",
    },
    {
      rank: 9,
      path: "api/router.ts",
      added: 9,
      removed: 0,
      risk: "low",
      summary: "Mounts the new admin migration routes. Existing route semantics stay untouched.",
    },
    {
      rank: 10,
      path: "api/admin/__tests__/migrations.test.ts",
      added: 96,
      removed: 0,
      risk: "low",
      summary: "Covers the happy path and rollback-gate refusal. Queue interaction remains untested.",
    },
    {
      rank: 11,
      path: "docs/runbooks/queue.md",
      added: 38,
      removed: 12,
      risk: "low",
      summary: "Documents the new retry policy and the rollback gate.",
    },
    {
      rank: 12,
      path: "docs/migrations.md",
      added: 24,
      removed: 8,
      risk: "low",
      summary: "How to declare a rollback. No behavior change.",
    },
    {
      rank: 13,
      path: "CHANGELOG.md",
      added: 6,
      removed: 0,
      risk: "low",
      summary: "Entry for 2.14.0. Mentions the retry backoff change.",
    },
    {
      rank: 14,
      path: "package.json",
      added: 4,
      removed: 1,
      risk: "low",
      summary: "Drizzle-kit bumped to 0.31.2. No breaking changes in the changelog.",
    },
    {
      rank: 15,
      path: "pnpm-lock.yaml",
      added: 9,
      removed: 4,
      risk: "low",
      summary: "Lockfile update for the drizzle-kit bump.",
    },
    {
      rank: 16,
      path: "scripts/dev/migrate.ts",
      added: 12,
      removed: 0,
      risk: "low",
      summary: "Local dev helper that invokes the runner outside of the queue.",
    },
    {
      rank: 17,
      path: ".env.example",
      added: 2,
      removed: 0,
      risk: "low",
      summary: "Documents PB_MIGRATE_DRAIN_ON_BOOT and PB_MIGRATE_LOCK_TIMEOUT_MS.",
    },
    {
      rank: 18,
      path: "README.md",
      added: 4,
      removed: 1,
      risk: "low",
      summary: "Mentions the runner under the Development section.",
    },
  ],
  verification: [
    "pnpm --filter @pullbrief/api test schema/migrations",
    "pnpm --filter @pullbrief/api test queue/worker",
    "Run the queue worker locally against a fresh database and confirm the drain advances the schema by exactly the two new migrations.",
    "In staging, attempt to apply a migration without a declared down(); the gate must refuse and the worker must continue.",
  ],
  openQuestions: [
    "Should the rollback gate require down() to be a real function, or is the current file-name check intentional?",
    "Is the 30s lock timeout safe for the largest Postgres instance in production? Audit-log creation has been slow under contention in the past.",
  ],
};

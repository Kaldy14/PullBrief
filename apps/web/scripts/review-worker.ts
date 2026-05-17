import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { runReviewWorker } = await import("../src/lib/review-jobs/worker");
  const once = process.argv.includes("--once") || process.env.PULLBRIEF_REVIEW_WORKER_ONCE === "1";
  const pollIntervalMs = numberEnv("PULLBRIEF_REVIEW_WORKER_POLL_MS") ?? 2_000;
  const stats = await runReviewWorker({ once, pollIntervalMs });

  if (once) {
    console.log(JSON.stringify(stats));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

function numberEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }

  return parsed;
}

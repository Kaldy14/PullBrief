import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { pruneReportContextPatches } = await import("../src/lib/reports/retention");
  const olderThanDays = numberEnv("PULLBRIEF_CONTEXT_RETENTION_DAYS") ?? 30;
  const limit = numberEnv("PULLBRIEF_CONTEXT_RETENTION_LIMIT") ?? 500;
  const result = await pruneReportContextPatches({ olderThanDays, limit });
  console.log(JSON.stringify({
    ...result,
    cutoff: result.cutoff.toISOString(),
  }));
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

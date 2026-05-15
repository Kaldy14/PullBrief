import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

type Database = NodePgDatabase<typeof schema>;

type GlobalWithDatabase = typeof globalThis & {
  pullbriefPgPool?: Pool;
  pullbriefDb?: Database;
};

const globalForDatabase = globalThis as GlobalWithDatabase;

function databaseUrl() {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    return url;
  }

  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("DATABASE_URL is required in production.");
  }

  return "postgresql://pullbrief:pullbrief@localhost:5432/pullbrief";
}

function createPool() {
  return new Pool({
    connectionString: databaseUrl(),
  });
}

function createDatabase() {
  const pool = process.env.NODE_ENV === "production"
    ? createPool()
    : (globalForDatabase.pullbriefPgPool ??= createPool());

  return drizzle(pool, { schema });
}

export const db = process.env.NODE_ENV === "production"
  ? createDatabase()
  : (globalForDatabase.pullbriefDb ??= createDatabase());

export type { Database };

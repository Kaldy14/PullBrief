import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";

const DEV_SECRET = "pullbrief-development-secret-change-before-production";

function authBaseUrl() {
  return process.env.BETTER_AUTH_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || "http://localhost:3000";
}

function authSecret() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }

  return DEV_SECRET;
}

function publicSignupEnabled() {
  return process.env.PULLBRIEF_ENABLE_PUBLIC_SIGNUP === "true"
    || process.env.PULLBRIEF_AUTH_SEEDING === "1";
}

export const auth = betterAuth({
  appName: "PullBrief",
  baseURL: authBaseUrl(),
  secret: authSecret(),
  trustedOrigins: [authBaseUrl()],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up") && !publicSignupEnabled()) {
        throw new APIError("FORBIDDEN", {
          message: "Sign-up is disabled. Ask a PullBrief admin to seed your account.",
        });
      }
    }),
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;

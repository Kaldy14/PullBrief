import { Webhooks } from "@octokit/webhooks";
import { NextResponse } from "next/server";

import { GitHubAppConfigError, requireGitHubWebhookSecret } from "@/lib/github/app-config";
import { handleGitHubWebhook } from "@/lib/github/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 1_000_000;

export async function POST(request: Request) {
  try {
    const webhookSecret = requireGitHubWebhookSecret();
    const contentLength = request.headers.get("content-length");

    if (contentLength && Number(contentLength) > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: "GitHub webhook payload is too large." }, { status: 413 });
    }

    const body = await request.text();

    if (new TextEncoder().encode(body).byteLength > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: "GitHub webhook payload is too large." }, { status: 413 });
    }
    const signature = request.headers.get("x-hub-signature-256");

    if (!signature) {
      return NextResponse.json({ error: "Missing X-Hub-Signature-256." }, { status: 401 });
    }

    const webhooks = new Webhooks({ secret: webhookSecret });
    const verified = await webhooks.verify(body, signature);

    if (!verified) {
      return NextResponse.json({ error: "Invalid GitHub webhook signature." }, { status: 401 });
    }

    const deliveryId = request.headers.get("x-github-delivery")?.trim();
    const event = request.headers.get("x-github-event")?.trim();

    if (!deliveryId || !event) {
      return NextResponse.json({ error: "Missing GitHub webhook delivery headers." }, { status: 400 });
    }

    const payload = parsePayload(body);
    const result = await handleGitHubWebhook({ deliveryId, event, payload });
    const status = result.status === "failed" ? 500 : 202;

    return NextResponse.json(result, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process GitHub webhook." },
      { status: error instanceof GitHubAppConfigError ? error.status : 500 },
    );
  }
}

function parsePayload(body: string): Record<string, unknown> {
  const parsed = JSON.parse(body) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("GitHub webhook payload must be a JSON object.");
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

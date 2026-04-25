import { NextResponse } from "next/server";
import {
  ingestWeeklyTrends,
  analyzePendingTrends,
} from "@/lib/actions/trends";
import { isMondayUtc } from "@/lib/trends/normalize";
import { withCronReport } from "@/lib/messaging/with-cron-report";

/**
 * Weekly trend pipeline entry point.
 *
 * Invoked daily at 09:00 UTC by Vercel Cron (see `vercel.json`). The
 * route decides at runtime what work to run:
 *
 *   - Mondays: `ingestWeeklyTrends()` — pull Google Trends, insert
 *     new rows as `pending`.
 *   - Every day (Phase E): run the analyzer on up to 20 `pending`
 *     rows. Phase B only has ingestion wired up.
 *
 * Both steps are idempotent:
 *   - Ingestion uses `UNIQUE (source, normalized_query, detected_week)`
 *     so re-running the same day is a no-op.
 *   - Analysis only picks rows still in `pending`, so re-running
 *     doesn't re-analyze already-processed trends.
 *
 * Request is guarded by the `CRON_SECRET` env var. Vercel Cron sends
 * an `Authorization: Bearer <secret>` header. Manual admin triggers
 * hit the same endpoint with the same header.
 */
export const maxDuration = 60;

interface CronSummary {
  status: "ok" | "skipped" | "error";
  ranIngestion: boolean;
  ranAnalysis: boolean;
  ingested?: number;
  analyzed?: number;
  published?: number;
  skippedDuplicate?: number;
  skippedEmpty?: number;
  errors: string[];
  detectedWeek?: string;
  timestamp: string;
}

async function weeklyHandler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${secret}`;
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const summary: CronSummary = {
    status: "ok",
    ranIngestion: false,
    ranAnalysis: false,
    errors: [],
    timestamp: now.toISOString(),
  };

  // Step 1 — Ingestion (Mondays only).
  // The `?force=1` query param bypasses the day-of-week gate so
  // admin manual triggers can run ingestion mid-week for testing.
  const url = new URL(req.url);
  const forceIngest = url.searchParams.get("force") === "1";

  if (isMondayUtc(now) || forceIngest) {
    summary.ranIngestion = true;
    try {
      const result = await ingestWeeklyTrends();
      summary.ingested = result.insertedCount;
      summary.skippedDuplicate = result.skippedDuplicateCount;
      summary.skippedEmpty = result.skippedEmptyCount;
      summary.detectedWeek = result.detectedWeek;
      if (result.errors.length > 0) {
        summary.errors.push(...result.errors);
      }
    } catch (err) {
      summary.status = "error";
      summary.errors.push(
        `ingestWeeklyTrends threw: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Step 2 — Analysis batch. Runs every day, picks up to 3 pending
  // rows and drives each through Layer 1 → 2 → 3. Successful
  // analyses flip straight to `published` (auto-publish policy).
  // Small batch size keeps us under the 60s serverless cap.
  summary.ranAnalysis = true;
  try {
    const batch = await analyzePendingTrends(3);
    summary.analyzed = batch.pickedCount;
    summary.published = batch.publishedCount;
    if (batch.failedCount > 0) {
      summary.errors.push(
        `${batch.failedCount} analysis failure(s): ${batch.results
          .filter((r) => r.outcome === "failed")
          .map((r) => `#${r.trendId}: ${r.reason}`)
          .join("; ")}`
      );
    }
  } catch (err) {
    summary.status = "error";
    summary.errors.push(
      `analyzePendingTrends threw: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Step 3 — Response. 200 unless something hard-errored.
  const statusCode = summary.status === "error" ? 500 : 200;
  if (!summary.ranIngestion && !summary.ranAnalysis) {
    summary.status = "skipped";
  }
  return NextResponse.json(summary, { status: statusCode });
}

export const GET = withCronReport("weekly", weeklyHandler);
// Allow POST for admin manual-trigger buttons that send a body.
export const POST = GET;

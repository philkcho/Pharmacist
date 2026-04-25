import { NextResponse } from "next/server";
import {
  fillIncompleteProducts,
  getIncompleteProductStats,
} from "@/lib/actions/fill-incomplete-products";
import { withCronReport } from "@/lib/messaging/with-cron-report";

/**
 * Daily sweep: fills missing image/verdict/analysis on existing medications.
 *
 * Runs AFTER the weekly/products crons so it picks up anything those
 * didn't finish. Processes up to 15 products per run by default.
 *
 * Query params:
 *   ?limit=N   — override batch size
 *   ?status    — return stats only, don't process
 *
 * Guarded by CRON_SECRET env var.
 */
export const maxDuration = 300;

async function fillHandler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);

  if (url.searchParams.has("status")) {
    const stats = await getIncompleteProductStats();
    return NextResponse.json({ status: "ok", stats });
  }

  const limit = Math.min(Number(url.searchParams.get("limit") ?? 15), 30);

  try {
    const result = await fillIncompleteProducts(limit);
    return NextResponse.json({
      status: "ok",
      result,
      stats: await getIncompleteProductStats(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/fill] Failed:", message);
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500 }
    );
  }
}

export const GET = withCronReport("fill", fillHandler);

import { NextResponse } from "next/server";
import {
  processProductBatch,
  getSeedProgress,
} from "@/lib/actions/product-batch";
import { withCronReport } from "@/lib/messaging/with-cron-report";

/**
 * Daily product batch pipeline.
 *
 * Processes the next N products from the seed list:
 * 1. Fetch FDA data (OTC drugs)
 * 2. Create medication record
 * 3. AI analysis (pros, cons, verdict, ingredients, score)
 * 4. Generate purchase links
 *
 * Designed to run daily via Vercel Cron or manual trigger.
 * Uses the Gemini free tier (20 calls/day) efficiently.
 *
 * Query params:
 *   ?limit=N  — override batch size (default 20)
 *   ?status   — just return progress stats, don't process
 *
 * Guarded by CRON_SECRET env var.
 */
export const maxDuration = 300; // 5 minutes for batch processing

async function productsHandler(req: Request) {
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

  // Status check mode
  if (url.searchParams.has("status")) {
    const progress = await getSeedProgress();
    return NextResponse.json({ status: "ok", progress });
  }

  // Batch processing mode
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? 20),
    50 // hard cap
  );

  try {
    const result = await processProductBatch(limit);
    return NextResponse.json({
      status: "ok",
      result,
      progress: await getSeedProgress(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/products] Batch failed:", message);
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500 }
    );
  }
}

export const GET = withCronReport("products", productsHandler);

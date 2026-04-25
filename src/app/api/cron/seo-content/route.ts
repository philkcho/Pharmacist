import { NextResponse } from "next/server";
import { generateSeoContentBatch } from "@/lib/actions/generate-seo-content-batch";
import { withCronReport } from "@/lib/messaging/with-cron-report";

/**
 * Daily SEO content generation cron.
 *
 * Generates missing safety articles, comparisons, and ingredient guides.
 * Rate-limited to stay within Gemini free-tier quota.
 *
 * Query params (all optional):
 *   ?safety=N        — override safety article batch size (default 3)
 *   ?comparisons=N   — override comparison batch size (default 2)
 *   ?ingredients=N   — override ingredient batch size (default 2)
 *
 * Guarded by CRON_SECRET env var.
 */
export const maxDuration = 300;

async function seoContentHandler(req: Request) {
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
  const safety = Number(url.searchParams.get("safety") ?? 3);
  const comparisons = Number(url.searchParams.get("comparisons") ?? 2);
  const ingredients = Number(url.searchParams.get("ingredients") ?? 2);

  try {
    const result = await generateSeoContentBatch({
      safety: Math.min(safety, 10),
      comparisons: Math.min(comparisons, 10),
      ingredients: Math.min(ingredients, 10),
    });

    return NextResponse.json({
      status: "ok",
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/seo-content] Failed:", message);
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500 }
    );
  }
}

export const GET = withCronReport("seo-content", seoContentHandler);

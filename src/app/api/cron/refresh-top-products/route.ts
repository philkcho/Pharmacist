import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRealProductImage } from "@/lib/images/search-product-image";
import { autoGeneratePurchaseLinks } from "@/lib/actions/purchase-links";
import { withCronReport } from "@/lib/messaging/with-cron-report";

/**
 * Quarterly refresh for featured products.
 *
 * Picks up to N featured (is_featured=true) medications that haven't
 * been updated in 90+ days and re-validates:
 *   1. image_url — re-runs Google CSE product image search; updates if found
 *   2. purchase links — re-runs autoGeneratePurchaseLinks to pick up new
 *      retailer URLs / deprecate dead ones
 *
 * Schedule: 1st of every 3rd month at 02:00 UTC (vercel.json).
 * Throttled to 30 products per run to stay within Google CSE quota.
 *
 * Guarded by CRON_SECRET. Same auth pattern as other crons in this repo.
 *
 * Why this exists: featured products surface in the homepage category
 * widget. Retailer image URLs rotate, products get discontinued, and
 * purchase links decay. Quarterly touch keeps the widget honest.
 */
export const maxDuration = 300; // 5 min

const BATCH_LIMIT = 30;
const STALE_DAYS = 90;

async function refreshTopProductsHandler(req: Request) {
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
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? BATCH_LIMIT),
    BATCH_LIMIT
  );

  const supabase = await createAdminClient();

  // Products older than STALE_DAYS, featured, with prior ingestion (name exists).
  const staleThreshold = new Date(
    Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: stale, error } = await supabase
    .from("medications")
    .select("id, name, slug, image_url, product_type, updated_at")
    .eq("is_featured", true)
    .eq("approval_status", "approved")
    .lt("updated_at", staleThreshold)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[cron/refresh-top-products] query failed:", error.message);
    return NextResponse.json(
      { status: "error", error: error.message },
      { status: 500 }
    );
  }

  if (!stale || stale.length === 0) {
    return NextResponse.json({
      status: "ok",
      refreshed: 0,
      message: "No featured products are stale.",
      timestamp: new Date().toISOString(),
    });
  }

  let imageRefreshed = 0;
  let linksRefreshed = 0;
  let errors = 0;
  const touchedIds: number[] = [];

  for (const row of stale) {
    const id = row.id as number;
    const name = row.name as string;
    try {
      // 1) Refresh image (skip if search returns null — keep existing)
      const nextImage = await fetchRealProductImage(name);
      if (nextImage && nextImage !== row.image_url) {
        const { error: imgErr } = await supabase
          .from("medications")
          .update({ image_url: nextImage })
          .eq("id", id);
        if (!imgErr) imageRefreshed++;
      }

      // 2) Refresh purchase links
      const productType = (row.product_type as string) ?? "supplement";
      await autoGeneratePurchaseLinks(id, name, productType);
      linksRefreshed++;

      // 3) Bump updated_at to push this row out of the stale window
      await supabase
        .from("medications")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);

      touchedIds.push(id);
    } catch (err) {
      errors++;
      console.warn(
        `[cron/refresh-top-products] ${name} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return NextResponse.json({
    status: "ok",
    considered: stale.length,
    imageRefreshed,
    linksRefreshed,
    errors,
    touchedIds,
    timestamp: new Date().toISOString(),
  });
}

export const GET = withCronReport(
  "refresh-top-products",
  refreshTopProductsHandler
);

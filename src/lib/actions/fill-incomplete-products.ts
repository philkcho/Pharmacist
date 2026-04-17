"use server";

/**
 * Fill Incomplete Products — periodic sweep that finds medications
 * missing image, verdict, pros, or analysis and fills them in using
 * ensureProductComplete.
 *
 * Runs daily via Vercel Cron (/api/cron/fill). Respects Gemini free
 * tier quota by processing at most N products per run.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProductComplete } from "@/lib/actions/ensure-product-complete";

export interface FillResult {
  found: number;
  processed: number;
  succeeded: number;
  failed: string[];
}

/**
 * Find products with incomplete data and fill them in.
 *
 * Incomplete = missing ANY of: image_url, verdict, pros (empty array).
 *
 * @param limit Max products to process this run (default 15, leaves
 *              some Gemini quota headroom for other features)
 */
export async function fillIncompleteProducts(
  limit = 15
): Promise<FillResult> {
  const admin = await createAdminClient();

  // Find products missing data. Prioritize approved products first,
  // then drafts (draft products show up in admin but not public UI).
  const { data: incomplete, error } = await admin
    .from("medications")
    .select("id, name, slug, image_url, verdict, pros, product_type, category_id")
    .or("image_url.is.null,verdict.is.null")
    .limit(limit);

  if (error) {
    console.error("[fill-incomplete] Query failed:", error.message);
    return { found: 0, processed: 0, succeeded: 0, failed: [error.message] };
  }

  type Row = {
    id: number;
    name: string;
    slug: string;
    image_url: string | null;
    verdict: string | null;
    pros: unknown;
    product_type: string | null;
    category_id: number | null;
  };

  const rows = (incomplete ?? []) as Row[];

  // Also include products where pros is an empty array
  const { data: emptyPros } = await admin
    .from("medications")
    .select("id, name, slug, image_url, verdict, pros, product_type, category_id")
    .not("image_url", "is", null)
    .not("verdict", "is", null)
    .limit(limit);

  const emptyProsRows = ((emptyPros ?? []) as Row[]).filter(
    (r) => !Array.isArray(r.pros) || (r.pros as unknown[]).length === 0
  );

  // Merge + dedupe
  const seen = new Set<number>();
  const targets: Row[] = [];
  for (const r of [...rows, ...emptyProsRows]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      targets.push(r);
      if (targets.length >= limit) break;
    }
  }

  const result: FillResult = {
    found: targets.length,
    processed: 0,
    succeeded: 0,
    failed: [],
  };

  if (targets.length === 0) {
    console.log("[fill-incomplete] Nothing to fill");
    return result;
  }

  console.log(`[fill-incomplete] Processing ${targets.length} incomplete products...`);

  // Resolve category slugs for targets
  const categoryIds = [...new Set(targets.map((t) => t.category_id).filter(Boolean))];
  const { data: categories } = await admin
    .from("categories")
    .select("id, slug")
    .in("id", categoryIds as number[]);
  const categorySlugMap = new Map(
    (categories ?? []).map((c: { id: number; slug: string }) => [c.id, c.slug])
  );

  for (const row of targets) {
    result.processed++;
    console.log(`\n[fill-incomplete] → ${row.name}`);

    try {
      const categorySlug = row.category_id
        ? categorySlugMap.get(row.category_id) ?? null
        : null;

      const ensured = await ensureProductComplete({
        name: row.name,
        productType:
          (row.product_type as
            | "otc_drug"
            | "supplement"
            | "cosmetic"
            | "quasi_drug"
            | undefined) ?? undefined,
        categorySlug,
      });

      if (ensured) {
        result.succeeded++;
        const missing: string[] = [];
        if (!ensured.imageUrl) missing.push("image");
        if (!ensured.hasAnalysis) missing.push("analysis");
        console.log(
          `  ✓ ${missing.length === 0 ? "complete" : `still missing: ${missing.join(", ")}`}`
        );
      } else {
        result.failed.push(row.name);
        console.log(`  ✗ ensureProductComplete returned null`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed.push(`${row.name}: ${msg.slice(0, 80)}`);
      console.log(`  ✗ Failed: ${msg.slice(0, 80)}`);
    }
  }

  console.log(
    `\n[fill-incomplete] Done: ${result.succeeded}/${result.processed} succeeded`
  );

  return result;
}

/**
 * Get stats about incomplete products (for admin dashboard).
 */
export async function getIncompleteProductStats(): Promise<{
  total: number;
  missingImage: number;
  missingAnalysis: number;
}> {
  const admin = await createAdminClient();

  const [totalRes, imgRes, analysisRes] = await Promise.all([
    admin.from("medications").select("id", { count: "exact", head: true }),
    admin
      .from("medications")
      .select("id", { count: "exact", head: true })
      .is("image_url", null),
    admin
      .from("medications")
      .select("id", { count: "exact", head: true })
      .is("verdict", null),
  ]);

  return {
    total: totalRes.count ?? 0,
    missingImage: imgRes.count ?? 0,
    missingAnalysis: analysisRes.count ?? 0,
  };
}

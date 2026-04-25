"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getBestOtcLabel } from "@/lib/fda/client";
import { analyzeProduct, type ProductAnalysis } from "@/lib/ai/analyze-product";
import { autoGeneratePurchaseLinks } from "@/lib/actions/purchase-links";
import { fetchRealProductImage } from "@/lib/images/search-product-image";
import {
  PRODUCT_SEED_LIST,
  type SeedProduct,
} from "@/lib/data/product-seed-list";

// ── Types ───────────────────────────────────────────────────

export interface BatchResult {
  total: number;
  created: number;
  analyzed: number;
  skipped: number;
  failed: string[];
}

// ── Helpers ─────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Get the next N products from the seed list that don't already
 * exist in the medications table.
 */
async function getNextBatch(limit: number): Promise<SeedProduct[]> {
  const admin = await createAdminClient();

  // Get all existing slugs
  const { data: existing } = await admin
    .from("medications")
    .select("slug");

  const existingSlugs = new Set(
    (existing ?? []).map((r: { slug: string }) => r.slug)
  );

  // Filter seed list to unprocessed products
  const pending = PRODUCT_SEED_LIST.filter(
    (p) => !existingSlugs.has(slugify(p.name))
  );

  return pending.slice(0, limit);
}

/**
 * Look up the category ID by slug. Returns null if not found.
 */
async function getCategoryId(
  categorySlug: string
): Promise<number | null> {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("categories")
    .select("id")
    .eq("slug", categorySlug)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Main Pipeline ───────────────────────────────────────────

/**
 * Process the next batch of products from the seed list.
 *
 * For each product:
 * 1. Skip if already in DB
 * 2. Fetch FDA data (OTC drugs only)
 * 3. Create medication record
 * 4. Run AI analysis (pros, cons, verdict, ingredients)
 * 5. Update medication with analysis results
 * 6. Generate purchase links
 *
 * @param limit Number of products to process (default 20)
 */
export async function processProductBatch(
  limit = 20
): Promise<BatchResult> {
  const admin = await createAdminClient();
  const batch = await getNextBatch(limit);

  const result: BatchResult = {
    total: batch.length,
    created: 0,
    analyzed: 0,
    skipped: 0,
    failed: [],
  };

  if (batch.length === 0) {
    console.log("[product-batch] All seed products already processed.");
    return result;
  }

  console.log(
    `[product-batch] Processing ${batch.length} products...`
  );

  for (const seed of batch) {
    const slug = slugify(seed.name);
    console.log(`\n[product-batch] → ${seed.name}`);

    try {
      // ── Step 1: Check if exists ──
      const { data: exists } = await admin
        .from("medications")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (exists) {
        console.log(`  Skipping (already exists)`);
        result.skipped++;
        continue;
      }

      // ── Step 2: Fetch FDA data (OTC drugs) ──
      let fdaData: {
        description?: string | null;
        activeIngredients?: string[];
        warnings?: string | null;
        sideEffects?: string | null;
        fdaSplId?: string | null;
        dosageForms?: string[];
      } = {};

      if (seed.productType === "otc_drug") {
        const label = await getBestOtcLabel(seed.name);
        if (label) {
          fdaData = {
            description: label.purpose ?? label.indications,
            activeIngredients: label.activeIngredients,
            warnings: label.warnings,
            sideEffects: label.sideEffects,
            fdaSplId: label.splId || null,
            dosageForms: label.dosageForms,
          };
          console.log(`  FDA data fetched`);
        } else {
          console.log(`  No FDA data (will use seed info only)`);
        }
      }

      // ── Step 3: Resolve category ──
      const categoryId = await getCategoryId(seed.category);

      // ── Step 3.5: Real product image via Google Custom Search ──
      // (Falls back to null → UI placeholder if no key or no match)
      let imageUrl: string | null = null;
      try {
        imageUrl = await fetchRealProductImage(seed.name);
        console.log(imageUrl ? `  Image found` : `  Image skipped (none)`);
      } catch {
        console.log(`  Image search skipped (error)`);
      }

      // ── Step 4: Create base medication record ──
      const { data: medication, error: insertError } = await admin
        .from("medications")
        .insert({
          name: seed.name,
          slug,
          generic_name: seed.genericName ?? null,
          brand_names: [seed.name],
          description: fdaData.description ?? null,
          product_type: seed.productType,
          active_ingredients: fdaData.activeIngredients ?? [],
          dosage_forms: fdaData.dosageForms ?? [],
          warnings: fdaData.warnings ?? null,
          side_effects: fdaData.sideEffects ?? null,
          fda_spl_id: fdaData.fdaSplId ?? null,
          is_otc: seed.productType === "otc_drug",
          source: seed.productType === "otc_drug" ? "fda" : "manual",
          approval_status: "draft",
          is_ai_drafted: true,
          category_id: categoryId,
          image_url: imageUrl,
          last_synced_at: new Date().toISOString(),
        })
        .select("id, name")
        .single();

      if (insertError) {
        console.log(`  Insert failed: ${insertError.message}`);
        result.failed.push(`${seed.name}: ${insertError.message}`);
        continue;
      }

      result.created++;
      console.log(`  Created (id=${medication.id})`);

      // ── Step 5: AI Analysis ──
      try {
        const analysis: ProductAnalysis = await analyzeProduct({
          name: seed.name,
          genericName: seed.genericName,
          productType: seed.productType,
          category: seed.category,
          activeIngredients: fdaData.activeIngredients,
          warnings: fdaData.warnings,
          sideEffects: fdaData.sideEffects,
          description: fdaData.description,
        });

        // Map ingredient analysis to the DB format
        const ingredientAnalysis = analysis.ingredientAnalysis.map(
          (ing) => ({
            name: ing.name,
            consumer: {
              purpose: ing.purpose,
              safetyNote: ing.safetyNote ?? null,
            },
          })
        );

        // Update medication with analysis results + auto-approve so it
        // surfaces on public pages (topic, search, expert picks).
        const { error: updateError } = await admin
          .from("medications")
          .update({
            description: analysis.description,
            verdict: analysis.verdict,
            pros: analysis.pros.map((text) => ({ text, sourceIds: [] })),
            cons: analysis.cons.map((text) => ({ text, sourceIds: [] })),
            ingredient_analysis: ingredientAnalysis,
            usage_guide_jsonb: analysis.usageGuide,
            comparison_score: analysis.comparisonScore,
            scoring_rationale: analysis.scoringRationale,
            recommended_for: analysis.recommendedFor,
            is_ai_drafted: true,
            approval_status: "approved",
            approved_at: new Date().toISOString(),
          })
          .eq("id", medication.id);

        if (updateError) {
          console.log(`  Analysis update failed: ${updateError.message}`);
          result.failed.push(`${seed.name} (analysis): ${updateError.message}`);
        } else {
          result.analyzed++;
          console.log(
            `  Analyzed (score=${analysis.comparisonScore}, ${analysis.pros.length} pros, ${analysis.cons.length} cons)`
          );
        }
      } catch (aiError) {
        const msg =
          aiError instanceof Error ? aiError.message : String(aiError);
        console.log(`  AI analysis failed: ${msg}`);
        result.failed.push(`${seed.name} (AI): ${msg}`);
        // Product still exists in DB without analysis — can retry later
      }

      // ── Step 6: Purchase Links ──
      try {
        await autoGeneratePurchaseLinks(
          medication.id,
          seed.name,
          seed.productType
        );
        console.log(`  Purchase links created`);
      } catch {
        console.log(`  Purchase link generation skipped`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  Failed: ${msg}`);
      result.failed.push(`${seed.name}: ${msg}`);
    }
  }

  console.log(
    `\n[product-batch] Done: ${result.created} created, ${result.analyzed} analyzed, ${result.skipped} skipped, ${result.failed.length} failed`
  );

  return result;
}

/**
 * Get stats about seed list progress.
 */
export async function getSeedProgress(): Promise<{
  total: number;
  processed: number;
  remaining: number;
}> {
  const admin = await createAdminClient();
  const { data: existing } = await admin
    .from("medications")
    .select("slug");

  const existingSlugs = new Set(
    (existing ?? []).map((r: { slug: string }) => r.slug)
  );

  const processed = PRODUCT_SEED_LIST.filter((p) =>
    existingSlugs.has(slugify(p.name))
  ).length;

  return {
    total: PRODUCT_SEED_LIST.length,
    processed,
    remaining: PRODUCT_SEED_LIST.length - processed,
  };
}

"use server";

/**
 * ensureProductComplete — Central utility that guarantees a product has
 * all the data needed for UI display:
 *   • Image (real product photo via Google CSE → Bing fallback)
 *   • FDA data (warnings, side effects, ingredients) when available
 *   • AI analysis (pros, cons, verdict, ingredient breakdown, score)
 *   • Purchase links (Amazon, iHerb, etc.)
 *
 * Called anywhere a product name surfaces in content:
 *   - matchProducts() → trend analysis
 *   - analyze-expert-video → YouTube transcript extraction
 *   - admin manual product creation
 *   - article generation product references
 *
 * Image policy: ONLY real product photos. No AI-generated images.
 * A placeholder is better than a misleading photo.
 *
 * Idempotent: if a product already has complete data, returns immediately
 * without any API calls. Missing pieces are filled in on-demand.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getBestOtcLabel } from "@/lib/fda/client";
import { analyzeProduct } from "@/lib/ai/analyze-product";
import { fetchRealProductImage } from "@/lib/images/search-product-image";
import { autoGeneratePurchaseLinks } from "@/lib/actions/purchase-links";

// ── Types ───────────────────────────────────────────────────

export type ProductType =
  | "otc_drug"
  | "supplement"
  | "cosmetic"
  | "quasi_drug";

export interface EnsureProductInput {
  name: string;
  genericName?: string | null;
  productType?: ProductType;
  categorySlug?: string | null;
}

export interface EnsuredProduct {
  id: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  hasAnalysis: boolean;
  hasFdaData: boolean;
}

// ── Helpers ─────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function inferProductType(name: string, categorySlug?: string | null): ProductType {
  const lower = name.toLowerCase();
  const cat = categorySlug?.toLowerCase() ?? "";

  if (cat.includes("k-beauty") || cat.includes("skin") || cat.includes("acne") || cat.includes("sunscreen") || cat.includes("moisturiz")) {
    return "cosmetic";
  }
  if (cat.includes("vitamin") || cat.includes("supplement") || lower.includes("vitamin") || lower.includes("supplement")) {
    return "supplement";
  }
  return "otc_drug";
}

async function getCategoryId(slug: string | null | undefined): Promise<number | null> {
  if (!slug) return null;
  const admin = await createAdminClient();
  const { data } = await admin
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Main Function ───────────────────────────────────────────

/**
 * Ensure a product exists in the DB with complete data.
 *
 * - Creates the record if missing
 * - Fetches FDA data if missing and applicable
 * - Generates image if missing
 * - Runs AI analysis if missing
 * - Creates purchase links if missing
 *
 * Returns the product row even if some enrichment steps fail (partial
 * data is still useful — blank UI is the thing we're trying to avoid).
 */
export async function ensureProductComplete(
  input: EnsureProductInput
): Promise<EnsuredProduct | null> {
  const admin = await createAdminClient();
  const slug = slugify(input.name);
  const productType = input.productType ?? inferProductType(input.name, input.categorySlug);

  // ── 1. Look up existing product ──
  const { data: existing } = await admin
    .from("medications")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  type Row = {
    id: number;
    slug: string;
    name: string;
    image_url: string | null;
    verdict: string | null;
    pros: unknown;
    cons: unknown;
    ingredient_analysis: unknown;
    fda_spl_id: string | null;
    active_ingredients: unknown;
    product_type: string | null;
  };

  let row = existing as Row | null;

  // ── 2. Create if missing ──
  if (!row) {
    const categoryId = await getCategoryId(input.categorySlug);

    // Try FDA first for OTC drugs
    let fdaData: {
      description?: string | null;
      activeIngredients?: string[];
      warnings?: string | null;
      sideEffects?: string | null;
      fdaSplId?: string | null;
      dosageForms?: string[];
    } = {};

    if (productType === "otc_drug") {
      try {
        const label = await getBestOtcLabel(input.name);
        if (label) {
          fdaData = {
            description: label.purpose ?? label.indications,
            activeIngredients: label.activeIngredients,
            warnings: label.warnings,
            sideEffects: label.sideEffects,
            fdaSplId: label.splId || null,
            dosageForms: label.dosageForms,
          };
        }
      } catch {
        // FDA fetch failed — continue without it
      }
    }

    // Fetch real product image (Google CSE → Bing fallback → Storage).
    // Returns a Supabase Storage URL, or null if no image found.
    // No AI-generated fallback — placeholder is better than a fake photo.
    let imageUrl: string | null = null;
    try {
      imageUrl = await fetchRealProductImage(input.name);
    } catch {
      // Image search failed — continue with null, UI shows placeholder
    }

    const { data: inserted, error } = await admin
      .from("medications")
      .insert({
        name: input.name,
        slug,
        generic_name: input.genericName ?? null,
        brand_names: [input.name],
        description: fdaData.description ?? null,
        product_type: productType,
        active_ingredients: fdaData.activeIngredients ?? [],
        dosage_forms: fdaData.dosageForms ?? [],
        warnings: fdaData.warnings ?? null,
        side_effects: fdaData.sideEffects ?? null,
        fda_spl_id: fdaData.fdaSplId ?? null,
        is_otc: productType === "otc_drug",
        source: productType === "otc_drug" && fdaData.fdaSplId ? "fda" : "manual",
        approval_status: "draft",
        is_ai_drafted: true,
        category_id: categoryId,
        image_url: imageUrl,
        last_synced_at: new Date().toISOString(),
      })
      .select("*")
      .single<Row>();

    if (error || !inserted) {
      console.warn("[ensureProductComplete] Insert failed:", error?.message);
      return null;
    }

    row = inserted;

    // Generate purchase links (non-blocking)
    autoGeneratePurchaseLinks(row.id, input.name, productType).catch(() => {});
  }

  // ── 3. Fill in missing image (Google CSE → Bing → Storage) ──
  if (!row.image_url) {
    try {
      const imageUrl = await fetchRealProductImage(row.name);
      if (imageUrl) {
        await admin
          .from("medications")
          .update({ image_url: imageUrl })
          .eq("id", row.id);
        row.image_url = imageUrl;
      }
    } catch {
      // Non-fatal — product still usable without image
    }
  }

  // ── 4. Fill in missing AI analysis ──
  const hasAnalysis =
    row.verdict != null &&
    Array.isArray(row.pros) &&
    (row.pros as unknown[]).length > 0;

  if (!hasAnalysis) {
    try {
      const analysis = await analyzeProduct({
        name: row.name,
        genericName: input.genericName ?? undefined,
        productType: (row.product_type as string) ?? productType,
        category: input.categorySlug ?? "general",
        activeIngredients: Array.isArray(row.active_ingredients)
          ? (row.active_ingredients as string[])
          : undefined,
      });

      const ingredientAnalysis = analysis.ingredientAnalysis.map((ing) => ({
        name: ing.name,
        consumer: {
          purpose: ing.purpose,
          safetyNote: ing.safetyNote ?? null,
        },
      }));

      // Auto-approve once analysis succeeds so products surface in
      // public UI (topic pages, search, expert picks). Keeps
      // is_ai_drafted=true so the "AI-drafted" badge still shows
      // for transparency.
      await admin
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
        .eq("id", row.id);

      row.verdict = analysis.verdict;
      row.pros = analysis.pros.map((text) => ({ text, sourceIds: [] }));
    } catch (err) {
      // AI quota or other failure — still return partial data
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ensureProductComplete] AI analysis skipped for ${row.name}:`, msg.slice(0, 100));
    }
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.image_url,
    hasAnalysis:
      row.verdict != null &&
      Array.isArray(row.pros) &&
      (row.pros as unknown[]).length > 0,
    hasFdaData: row.fda_spl_id != null,
  };
}

/**
 * Batch version — ensures multiple products in sequence.
 * Use for expert picks / trends that surface many products at once.
 */
export async function ensureProductsComplete(
  inputs: EnsureProductInput[]
): Promise<EnsuredProduct[]> {
  const results: EnsuredProduct[] = [];
  for (const input of inputs) {
    const res = await ensureProductComplete(input);
    if (res) results.push(res);
  }
  return results;
}

"use server";

/**
 * Daily SEO content generation batch.
 *
 * Auto-fills missing SEO pages each night:
 *   1. Safety articles — for products missing safety_article_jsonb
 *   2. Comparisons — top-scoring product pairs within the same product_type
 *   3. Ingredient guides — for ingredients present in 2+ products but no guide yet
 *
 * Runs via /api/cron/seo-content.
 *
 * Rate limits (per run, to stay under Gemini free tier):
 *   - 3 safety articles
 *   - 2 comparisons
 *   - 2 ingredient guides
 *   = 7 Gemini calls per day, ~210/month
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { generateSafetyArticle } from "@/lib/ai/generate-safety-article";
import { generateComparison } from "@/lib/ai/generate-comparison";
import { generateIngredientGuide } from "@/lib/ai/generate-ingredient-guide";

export interface SeoBatchResult {
  safety: { processed: number; succeeded: number; failed: string[] };
  comparisons: { processed: number; succeeded: number; failed: string[] };
  ingredients: { processed: number; succeeded: number; failed: string[] };
}

// ── Safety articles ─────────────────────────────────────────

async function batchSafetyArticles(limit: number): Promise<
  SeoBatchResult["safety"]
> {
  const admin = createAdminClient();
  const result = { processed: 0, succeeded: 0, failed: [] as string[] };

  // Top-scoring approved products missing safety article
  const { data: products } = await admin
    .from("medications")
    .select(
      "id, name, slug, generic_name, product_type, warnings, side_effects, active_ingredients, verdict"
    )
    .eq("approval_status", "approved")
    .is("safety_article_jsonb", null)
    .not("verdict", "is", null)
    .order("comparison_score", { ascending: false, nullsFirst: false })
    .limit(limit);

  for (const product of products ?? []) {
    result.processed++;
    try {
      const article = await generateSafetyArticle({
        productName: product.name as string,
        productType: (product.product_type as string) ?? "otc_drug",
        genericName: (product.generic_name as string) ?? null,
        activeIngredients: Array.isArray(product.active_ingredients)
          ? (product.active_ingredients as string[])
          : [],
        fdaWarnings: (product.warnings as string) ?? null,
        fdaSideEffects: (product.side_effects as string) ?? null,
        verdict: (product.verdict as string) ?? null,
      });

      await admin
        .from("medications")
        .update({
          safety_article_jsonb: article,
          safety_article_generated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
      result.succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed.push(`${product.name}: ${msg.slice(0, 80)}`);
    }
  }

  return result;
}

// ── Comparisons ─────────────────────────────────────────────

function canonicalOrder(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function batchComparisons(
  limit: number
): Promise<SeoBatchResult["comparisons"]> {
  const admin = createAdminClient();
  const result = { processed: 0, succeeded: 0, failed: [] as string[] };

  // Strategy: for each product_type, take top 6 scoring products.
  // Within each type, pick the top pair not yet generated.
  const types: Array<"otc_drug" | "supplement" | "cosmetic" | "quasi_drug"> = [
    "otc_drug",
    "supplement",
    "cosmetic",
  ];

  const candidatePairs: Array<{
    typeLabel: string;
    pA: Record<string, unknown>;
    pB: Record<string, unknown>;
  }> = [];

  for (const type of types) {
    const { data: top } = await admin
      .from("medications")
      .select(
        "id, name, slug, generic_name, product_type, active_ingredients, verdict, pros, cons, price_range, comparison_score"
      )
      .eq("approval_status", "approved")
      .eq("product_type", type)
      .not("verdict", "is", null)
      .order("comparison_score", { ascending: false, nullsFirst: false })
      .limit(6);

    const pool = top ?? [];
    // Generate all pairs within this type
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        candidatePairs.push({
          typeLabel: type,
          pA: pool[i],
          pB: pool[j],
        });
      }
    }
  }

  // Filter out already-generated pairs
  const { data: existing } = await admin
    .from("product_comparisons")
    .select("slug_a, slug_b");
  const existingSet = new Set(
    (existing ?? []).map((e) => `${e.slug_a}|${e.slug_b}`)
  );

  const notYetGenerated = candidatePairs.filter(({ pA, pB }) => {
    const [a, b] = canonicalOrder(pA.slug as string, pB.slug as string);
    return !existingSet.has(`${a}|${b}`);
  });

  // Take up to `limit` pairs
  const toProcess = notYetGenerated.slice(0, limit);

  for (const { pA, pB } of toProcess) {
    result.processed++;
    const [canonA, canonB] = canonicalOrder(
      pA.slug as string,
      pB.slug as string
    );
    const productA = pA.slug === canonA ? pA : pB;
    const productB = pA.slug === canonB ? pA : pB;

    try {
      const toInput = (p: Record<string, unknown>) => {
        const prosRaw = p.pros;
        const consRaw = p.cons;
        return {
          name: p.name as string,
          slug: p.slug as string,
          productType: (p.product_type as string) ?? "otc_drug",
          genericName: (p.generic_name as string) ?? null,
          activeIngredients: Array.isArray(p.active_ingredients)
            ? (p.active_ingredients as string[])
            : [],
          verdict: (p.verdict as string) ?? null,
          pros: Array.isArray(prosRaw)
            ? (prosRaw as Array<{ text?: string } | string>)
                .map((x) => (typeof x === "string" ? x : x.text ?? ""))
                .filter(Boolean)
            : [],
          cons: Array.isArray(consRaw)
            ? (consRaw as Array<{ text?: string } | string>)
                .map((x) => (typeof x === "string" ? x : x.text ?? ""))
                .filter(Boolean)
            : [],
          priceRange: (p.price_range as string) ?? null,
        };
      };

      const article = await generateComparison({
        productA: toInput(productA),
        productB: toInput(productB),
      });

      await admin.from("product_comparisons").insert({
        slug_a: canonA,
        slug_b: canonB,
        article_jsonb: article,
      });
      result.succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed.push(
        `${productA.slug}-vs-${productB.slug}: ${msg.slice(0, 80)}`
      );
    }
  }

  return result;
}

// ── Ingredient guides ──────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function batchIngredientGuides(
  limit: number
): Promise<SeoBatchResult["ingredients"]> {
  const admin = createAdminClient();
  const result = { processed: 0, succeeded: 0, failed: [] as string[] };

  // Aggregate ingredient occurrences across approved products
  const { data: products } = await admin
    .from("medications")
    .select("name, product_type, active_ingredients, ingredient_analysis")
    .eq("approval_status", "approved");

  const ingredientCounts = new Map<
    string,
    { count: number; products: string[]; types: Set<string> }
  >();

  for (const p of products ?? []) {
    const pType = (p.product_type as string) ?? "otc_drug";
    const pName = p.name as string;

    // From active_ingredients
    if (Array.isArray(p.active_ingredients)) {
      for (const ing of p.active_ingredients as string[]) {
        if (typeof ing !== "string" || ing.length < 3) continue;
        const slug = slugify(ing);
        if (!slug) continue;
        const entry = ingredientCounts.get(slug) ?? {
          count: 0,
          products: [],
          types: new Set(),
        };
        entry.count++;
        if (entry.products.length < 5) entry.products.push(pName);
        entry.types.add(pType);
        ingredientCounts.set(slug, entry);
      }
    }

    // From ingredient_analysis
    if (Array.isArray(p.ingredient_analysis)) {
      for (const ing of p.ingredient_analysis as Array<{ name?: string }>) {
        if (typeof ing.name !== "string" || ing.name.length < 3) continue;
        const slug = slugify(ing.name);
        if (!slug) continue;
        const entry = ingredientCounts.get(slug) ?? {
          count: 0,
          products: [],
          types: new Set(),
        };
        entry.count++;
        if (entry.products.length < 5) entry.products.push(pName);
        entry.types.add(pType);
        ingredientCounts.set(slug, entry);
      }
    }
  }

  // Filter out already-generated guides
  const { data: existing } = await admin
    .from("ingredient_guides")
    .select("slug");
  const existingSlugs = new Set((existing ?? []).map((e) => e.slug as string));

  // Top ingredients by frequency, not yet generated
  const sorted = Array.from(ingredientCounts.entries())
    .filter(([slug, data]) => !existingSlugs.has(slug) && data.count >= 2)
    .sort((a, b) => b[1].count - a[1].count);

  const toProcess = sorted.slice(0, limit);

  for (const [slug, data] of toProcess) {
    result.processed++;
    const name = slug
      .split("-")
      .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(" ");
    const category = data.types.has("cosmetic") ? "skincare" : "supplement";

    try {
      const article = await generateIngredientGuide({
        name,
        category,
        foundInProducts: data.products,
      });

      await admin.from("ingredient_guides").insert({
        slug,
        name,
        article_jsonb: article,
      });
      result.succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed.push(`${name}: ${msg.slice(0, 80)}`);
    }
  }

  return result;
}

// ── Main batch function ─────────────────────────────────────

export async function generateSeoContentBatch(limits?: {
  safety?: number;
  comparisons?: number;
  ingredients?: number;
}): Promise<SeoBatchResult> {
  const safetyLimit = limits?.safety ?? 3;
  const comparisonLimit = limits?.comparisons ?? 2;
  const ingredientLimit = limits?.ingredients ?? 2;

  console.log(
    `[seo-content] Starting batch: safety=${safetyLimit}, comparisons=${comparisonLimit}, ingredients=${ingredientLimit}`
  );

  const safety = await batchSafetyArticles(safetyLimit);
  console.log(`[seo-content] Safety: ${safety.succeeded}/${safety.processed}`);

  const comparisons = await batchComparisons(comparisonLimit);
  console.log(
    `[seo-content] Comparisons: ${comparisons.succeeded}/${comparisons.processed}`
  );

  const ingredients = await batchIngredientGuides(ingredientLimit);
  console.log(
    `[seo-content] Ingredients: ${ingredients.succeeded}/${ingredients.processed}`
  );

  return { safety, comparisons, ingredients };
}

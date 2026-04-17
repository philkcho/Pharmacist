"use server";

/**
 * Server action: get or generate "Is X Safe?" article for a product.
 *
 * Cache strategy:
 *   - On first request, check medications.safety_article_jsonb.
 *   - If present, return cached copy.
 *   - If missing, generate via Gemini, write back to DB, return fresh copy.
 *
 * This keeps the /is-safe/[slug] page fast on subsequent hits without
 * burning Gemini quota per pageview.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  generateSafetyArticle,
  type SafetyArticle,
} from "@/lib/ai/generate-safety-article";

export interface SafetyPageData {
  product: {
    id: number;
    name: string;
    slug: string;
    genericName: string | null;
    productType: string;
    imageUrl: string | null;
    verdict: string | null;
  };
  article: SafetyArticle;
  generatedAt: string;
}

export async function getOrGenerateSafetyArticle(
  slug: string
): Promise<SafetyPageData | null> {
  const supabase = await createClient();

  // Fetch product (RLS ensures only approved ones surface publicly)
  const { data: product } = await supabase
    .from("medications")
    .select(
      "id, name, slug, generic_name, product_type, image_url, verdict, warnings, side_effects, active_ingredients, safety_article_jsonb, safety_article_generated_at"
    )
    .eq("slug", slug)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (!product) return null;

  // Use cached article if present
  if (product.safety_article_jsonb) {
    return {
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        genericName: product.generic_name,
        productType: product.product_type ?? "otc_drug",
        imageUrl: product.image_url,
        verdict: product.verdict,
      },
      article: product.safety_article_jsonb as SafetyArticle,
      generatedAt:
        product.safety_article_generated_at ?? new Date().toISOString(),
    };
  }

  // Generate fresh via Gemini
  let article: SafetyArticle;
  try {
    article = await generateSafetyArticle({
      productName: product.name,
      productType: product.product_type ?? "otc_drug",
      genericName: product.generic_name,
      activeIngredients: Array.isArray(product.active_ingredients)
        ? (product.active_ingredients as string[])
        : undefined,
      fdaWarnings: product.warnings,
      fdaSideEffects: product.side_effects,
      verdict: product.verdict,
    });
  } catch (err) {
    console.warn(
      "[safety-article] Generation failed for",
      product.name,
      err instanceof Error ? err.message : err
    );
    return null;
  }

  // Persist via admin client (RLS bypass) — fire and forget is fine,
  // but we await so we can log errors.
  const admin = createAdminClient();
  const generatedAt = new Date().toISOString();
  const { error: dbError } = await admin
    .from("medications")
    .update({
      safety_article_jsonb: article,
      safety_article_generated_at: generatedAt,
    })
    .eq("id", product.id);

  if (dbError) {
    console.warn(
      "[safety-article] Failed to cache article:",
      dbError.message
    );
  }

  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      genericName: product.generic_name,
      productType: product.product_type ?? "otc_drug",
      imageUrl: product.image_url,
      verdict: product.verdict,
    },
    article,
    generatedAt,
  };
}

export async function listProductsWithSafetyArticle(): Promise<
  Array<{ slug: string; updatedAt: string | null }>
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("medications")
    .select("slug, safety_article_generated_at")
    .eq("approval_status", "approved")
    .not("safety_article_jsonb", "is", null);
  return (data ?? []).map((d) => ({
    slug: d.slug as string,
    updatedAt: d.safety_article_generated_at as string | null,
  }));
}

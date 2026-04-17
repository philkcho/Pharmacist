"use server";

/**
 * Ingredient guide: get or generate "What is X?" article.
 *
 * URL shape: /ingredients/[slug]  (e.g. /ingredients/niacinamide)
 *
 * Slug is normalized (lowercase, hyphenated). Name is stored separately
 * for display. We aggregate which products in the DB contain the
 * ingredient to enrich the "commonly found in" list.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  generateIngredientGuide,
  type IngredientGuide,
} from "@/lib/ai/generate-ingredient-guide";

export interface IngredientPageData {
  slug: string;
  name: string;
  article: IngredientGuide;
  generatedAt: string;
  /** Approved products that contain this ingredient. */
  foundInProducts: Array<{
    slug: string;
    name: string;
    imageUrl: string | null;
    productType: string;
  }>;
}

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function getOrGenerateIngredientGuide(
  slug: string
): Promise<IngredientPageData | null> {
  const supabase = await createClient();

  // Fetch approved products containing this ingredient (fuzzy match)
  // Ingredient name in active_ingredients array OR appears in ingredient_analysis names
  const searchName = slugToName(slug);

  const { data: products } = await supabase
    .from("medications")
    .select("slug, name, image_url, product_type, active_ingredients, ingredient_analysis")
    .eq("approval_status", "approved")
    .limit(200);

  const matchedProducts = (products ?? []).filter((p) => {
    const lowerSearch = searchName.toLowerCase();
    const activeMatch = Array.isArray(p.active_ingredients)
      ? (p.active_ingredients as string[]).some((ing) =>
          ing.toLowerCase().includes(lowerSearch)
        )
      : false;
    const analysisMatch = Array.isArray(p.ingredient_analysis)
      ? (p.ingredient_analysis as Array<{ name?: string }>).some((ing) =>
          typeof ing.name === "string" &&
          ing.name.toLowerCase().includes(lowerSearch)
        )
      : false;
    return activeMatch || analysisMatch;
  });

  const foundInProducts = matchedProducts.slice(0, 12).map((p) => ({
    slug: p.slug as string,
    name: p.name as string,
    imageUrl: (p.image_url as string) ?? null,
    productType: (p.product_type as string) ?? "otc_drug",
  }));

  // Check cache
  const { data: cached } = await supabase
    .from("ingredient_guides")
    .select("name, article_jsonb, generated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (cached) {
    return {
      slug,
      name: cached.name as string,
      article: cached.article_jsonb as IngredientGuide,
      generatedAt: cached.generated_at as string,
      foundInProducts,
    };
  }

  // Don't generate unless the ingredient is actually used in at least one product.
  // This prevents random URL spam from generating arbitrary ingredient pages.
  if (foundInProducts.length === 0) return null;

  // Generate via Gemini
  const category =
    foundInProducts[0]?.productType === "cosmetic" ? "skincare" : "supplement";

  let article: IngredientGuide;
  try {
    article = await generateIngredientGuide({
      name: searchName,
      category,
      foundInProducts: foundInProducts.map((p) => p.name),
    });
  } catch (err) {
    console.warn(
      "[ingredient-guide] Generation failed for",
      slug,
      err instanceof Error ? err.message : err
    );
    return null;
  }

  // Persist
  const admin = createAdminClient();
  const generatedAt = new Date().toISOString();
  await admin.from("ingredient_guides").insert({
    slug,
    name: searchName,
    article_jsonb: article,
    generated_at: generatedAt,
  });

  return {
    slug,
    name: searchName,
    article,
    generatedAt,
    foundInProducts,
  };
}

export async function listPublishedIngredientGuides(): Promise<
  Array<{ slug: string; updatedAt: string | null }>
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ingredient_guides")
    .select("slug, updated_at");
  return (data ?? []).map((d) => ({
    slug: d.slug as string,
    updatedAt: d.updated_at as string | null,
  }));
}

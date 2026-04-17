"use server";

/**
 * Product comparison: get or generate "X vs Y" article.
 *
 * URL shape: /vs/[slug-a]-vs-[slug-b]
 * Canonical: slugs sorted alphabetically so "a-vs-b" and "b-vs-a"
 * resolve to the same cached row (and the page redirects B-vs-A → A-vs-B).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  generateComparison,
  type ComparisonArticle,
  type ComparisonProductInput,
} from "@/lib/ai/generate-comparison";

export interface ComparisonPageData {
  productA: ComparisonProductInput & { imageUrl: string | null };
  productB: ComparisonProductInput & { imageUrl: string | null };
  article: ComparisonArticle;
  generatedAt: string;
  /** Canonical pair slug (alphabetically sorted). */
  canonicalPairSlug: string;
}

/**
 * Sort two slugs alphabetically to produce the canonical pair key.
 */
function canonicalOrder(a: string, b: string): [string, string, boolean] {
  return a < b ? [a, b, false] : [b, a, true];
}

export async function getOrGenerateComparison(
  pairSlug: string
): Promise<
  | { kind: "ok"; data: ComparisonPageData }
  | { kind: "redirect"; to: string }
  | { kind: "not_found" }
> {
  // Parse "[slug-a]-vs-[slug-b]"
  const parts = pairSlug.split("-vs-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { kind: "not_found" };
  }
  const [inputA, inputB] = parts;

  // Same product on both sides → bad URL
  if (inputA === inputB) return { kind: "not_found" };

  // Canonicalize: sort alphabetically
  const [canonA, canonB, wasReordered] = canonicalOrder(inputA, inputB);
  const canonicalPairSlug = `${canonA}-vs-${canonB}`;

  // If the URL had slugs in the non-canonical order, redirect to canonical.
  if (wasReordered) {
    return { kind: "redirect", to: `/vs/${canonicalPairSlug}` };
  }

  const supabase = await createClient();

  // Fetch both products — approved only
  const { data: products } = await supabase
    .from("medications")
    .select(
      "id, name, slug, generic_name, product_type, image_url, verdict, pros, cons, active_ingredients, price_range"
    )
    .in("slug", [canonA, canonB])
    .eq("approval_status", "approved");

  if (!products || products.length !== 2) return { kind: "not_found" };

  const pA = products.find((p) => p.slug === canonA);
  const pB = products.find((p) => p.slug === canonB);
  if (!pA || !pB) return { kind: "not_found" };

  // Check cache
  const { data: cached } = await supabase
    .from("product_comparisons")
    .select("article_jsonb, generated_at")
    .eq("slug_a", canonA)
    .eq("slug_b", canonB)
    .maybeSingle();

  const productAInput = productToInput(pA);
  const productBInput = productToInput(pB);

  if (cached) {
    return {
      kind: "ok",
      data: {
        productA: { ...productAInput, imageUrl: pA.image_url },
        productB: { ...productBInput, imageUrl: pB.image_url },
        article: cached.article_jsonb as ComparisonArticle,
        generatedAt: cached.generated_at as string,
        canonicalPairSlug,
      },
    };
  }

  // Generate via Gemini
  let article: ComparisonArticle;
  try {
    article = await generateComparison({
      productA: productAInput,
      productB: productBInput,
    });
  } catch (err) {
    console.warn(
      "[comparison] Generation failed:",
      err instanceof Error ? err.message : err
    );
    return { kind: "not_found" };
  }

  // Persist
  const admin = createAdminClient();
  const generatedAt = new Date().toISOString();
  await admin.from("product_comparisons").insert({
    slug_a: canonA,
    slug_b: canonB,
    article_jsonb: article,
    generated_at: generatedAt,
  });

  return {
    kind: "ok",
    data: {
      productA: { ...productAInput, imageUrl: pA.image_url },
      productB: { ...productBInput, imageUrl: pB.image_url },
      article,
      generatedAt,
      canonicalPairSlug,
    },
  };
}

function productToInput(
  row: Record<string, unknown>
): ComparisonProductInput {
  const prosRaw = row.pros;
  const consRaw = row.cons;
  const prosArr = Array.isArray(prosRaw)
    ? (prosRaw as Array<{ text?: string } | string>).map((p) =>
        typeof p === "string" ? p : p.text ?? ""
      ).filter(Boolean)
    : [];
  const consArr = Array.isArray(consRaw)
    ? (consRaw as Array<{ text?: string } | string>).map((c) =>
        typeof c === "string" ? c : c.text ?? ""
      ).filter(Boolean)
    : [];

  return {
    name: row.name as string,
    slug: row.slug as string,
    productType: (row.product_type as string) ?? "otc_drug",
    genericName: (row.generic_name as string) ?? null,
    activeIngredients: Array.isArray(row.active_ingredients)
      ? (row.active_ingredients as string[])
      : [],
    verdict: (row.verdict as string) ?? null,
    pros: prosArr,
    cons: consArr,
    priceRange: (row.price_range as string) ?? null,
  };
}

export async function listPublishedComparisonPairs(): Promise<
  Array<{ slugA: string; slugB: string; updatedAt: string | null }>
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("product_comparisons")
    .select("slug_a, slug_b, updated_at");
  return (data ?? []).map((d) => ({
    slugA: d.slug_a as string,
    slugB: d.slug_b as string,
    updatedAt: d.updated_at as string | null,
  }));
}

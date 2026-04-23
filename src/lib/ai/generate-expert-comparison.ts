/**
 * AI-powered N-product comparison for Dr.'s Analysis "Products at a Glance" section.
 *
 * Takes 2-5 products mentioned in a single expert pick and produces:
 *   - Shared vs distinctive ingredient summary + pharmacist note
 *   - Per-product "Best for / Avoid if" efficacy verdicts
 *   - Value pick (best price/efficacy trade-off)
 *   - Overall takeaway
 *
 * Cached in expert_picks.comparison_jsonb. Complementary to the 2-product
 * /vs/[pair] comparison in generate-comparison.ts — this one stays inline
 * within a single editorial article.
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

// ── Zod Schema ──────────────────────────────────────────────

export const ExpertComparisonSchema = z.object({
  ingredientSummary: z.object({
    shared: z
      .array(z.string())
      .max(6)
      .describe(
        "Active ingredients or ingredient families found in 2+ of the input products. Empty array if none overlap."
      ),
    distinctive: z
      .record(z.string(), z.array(z.string()).max(3))
      .describe(
        "Map of product slug → 1-3 ingredients unique to that product (not found in others). Key must be a slug from the input list."
      ),
    pharmacistNote: z
      .string()
      .describe(
        "1-2 sentence pharmacist take on what the shared/distinctive pattern means for the reader's choice. Evidence-grounded, no hype."
      ),
  }),
  efficacyVerdicts: z
    .array(
      z.object({
        slug: z.string().describe("Must be a slug from the input list."),
        bestFor: z
          .string()
          .describe(
            "1 sentence: who/when this product is the right pick. Specific situation, not vague."
          ),
        avoidIf: z
          .string()
          .describe(
            "1 sentence: when another product on this list would serve better."
          ),
      })
    )
    .describe("One verdict object per input product."),
  valuePick: z.object({
    slug: z.string().describe("Must be a slug from the input list."),
    reason: z
      .string()
      .describe(
        "1-2 sentences: why this product offers the best price-to-efficacy ratio within this group. Reference priceRange + active ingredients or efficacy when possible."
      ),
  }),
  overallTakeaway: z
    .string()
    .describe(
      "2-3 sentence closing summary on how to choose among these products. Actionable, not wishy-washy."
    ),
});

export type ExpertComparison = z.infer<typeof ExpertComparisonSchema>;

// ── Input ───────────────────────────────────────────────────

export interface ExpertComparisonProduct {
  name: string;
  slug: string;
  productType: string;
  genericName?: string | null;
  ingredients: Array<{ name: string; purpose?: string }>;
  pros: string[];
  cons: string[];
  verdict?: string | null;
  priceRange?: string | null;
}

export interface ExpertComparisonInput {
  articleTitle: string;
  articleCategory: string; // "health" | "skin-care" | "wellness"
  products: ExpertComparisonProduct[];
}

// ── Prompt ──────────────────────────────────────────────────

function formatProduct(p: ExpertComparisonProduct, index: number): string {
  const lines: string[] = [
    `Product ${index + 1}: ${p.name}`,
    `  slug: ${p.slug}`,
    `  type: ${p.productType}`,
  ];
  if (p.genericName) lines.push(`  generic: ${p.genericName}`);
  if (p.ingredients.length > 0) {
    const ings = p.ingredients
      .slice(0, 8)
      .map((i) => (i.purpose ? `${i.name} (${i.purpose})` : i.name))
      .join(", ");
    lines.push(`  ingredients: ${ings}`);
  }
  if (p.verdict) lines.push(`  verdict: ${p.verdict}`);
  if (p.pros.length > 0) lines.push(`  pros: ${p.pros.slice(0, 5).join("; ")}`);
  if (p.cons.length > 0) lines.push(`  cons: ${p.cons.slice(0, 5).join("; ")}`);
  if (p.priceRange) lines.push(`  price: ${p.priceRange}`);
  return lines.join("\n");
}

// ── Main ────────────────────────────────────────────────────

export async function generateExpertComparison(
  input: ExpertComparisonInput
): Promise<ExpertComparison> {
  if (input.products.length < 2) {
    throw new Error(
      "generateExpertComparison requires at least 2 products"
    );
  }

  const slugList = input.products.map((p) => p.slug).join(", ");
  const productBlocks = input.products
    .map((p, i) => formatProduct(p, i))
    .join("\n\n");

  const prompt = `You are a US pharmacist writing an inline "Products at a Glance" comparison for an editorial research article on AI PharmCare. The article is titled "${input.articleTitle}" (category: ${input.articleCategory}).

Below are ${input.products.length} products mentioned in the article. Produce a structured comparison per the output schema.

${productBlocks}

=============================================
CRITICAL RULES
=============================================

1. SLUG FIDELITY
   Every slug field in your output MUST be one of: ${slugList}
   Do not invent, shorten, or modify slugs. Do not use product names where a slug is required.

2. VOICE
   - Write as AI PharmCare's own pharmacist research (no video/speaker/channel references)
   - Do NOT use "overseas", "foreign", "imported" — the audience is American, these products are domestic for them
   - Evidence-grounded, no marketing hype, no "consult your doctor" dodges
   - Plain English, conversational but authoritative

3. INGREDIENT SUMMARY
   - "shared": only list ingredients or ingredient categories (e.g. "ceramides", "niacinamide", "acetaminophen") that appear in 2+ of the input products. Empty if none overlap.
   - "distinctive": map each slug to the 1-3 ingredients unique to that product. Omit a slug if it has no distinctive ingredients.
   - "pharmacistNote": 1-2 sentences on what the pattern means practically — e.g. "All three lean on niacinamide as the active. Product X adds peptides for anti-aging, while the others stay simpler."

4. EFFICACY VERDICTS
   - Produce exactly one verdict per input product
   - "bestFor": specific situation — "Sensitive skin starting a vitamin C routine", NOT "People who want good skin"
   - "avoidIf": point to a trade-off that makes another product on this list better for that case

5. VALUE PICK
   - Pick exactly one slug from the input list
   - "reason" must cite price AND efficacy/ingredients — e.g. "Matches the $30+ products on actives (L-ascorbic acid 10%) at under half the price"

6. OVERALL TAKEAWAY
   - 2-3 sentences that help the reader decide
   - Avoid "it depends" — if all else is equal, say so and give a tiebreaker

Generate all fields of the structured output.`;

  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: ExpertComparisonSchema,
    prompt,
    temperature: 0.4,
  });

  // Post-validation: strip any slugs the model invented outside the input set.
  const validSlugs = new Set(input.products.map((p) => p.slug));
  const filteredDistinctive: Record<string, string[]> = {};
  for (const [slug, items] of Object.entries(object.ingredientSummary.distinctive)) {
    if (validSlugs.has(slug)) filteredDistinctive[slug] = items;
  }
  const filteredVerdicts = object.efficacyVerdicts.filter((v) =>
    validSlugs.has(v.slug)
  );
  const valuePickSlug = validSlugs.has(object.valuePick.slug)
    ? object.valuePick.slug
    : input.products[0].slug;

  return {
    ingredientSummary: {
      shared: object.ingredientSummary.shared,
      distinctive: filteredDistinctive,
      pharmacistNote: object.ingredientSummary.pharmacistNote,
    },
    efficacyVerdicts: filteredVerdicts,
    valuePick: {
      slug: valuePickSlug,
      reason: object.valuePick.reason,
    },
    overallTakeaway: object.overallTakeaway,
  };
}

/**
 * Suggest real brand-name products for a trend article whose
 * `matchProducts()` query returned too few approved medications.
 *
 * Given the article's topic + entities + already-matched product names,
 * Gemini generates N real, purchasable US-retailer brand-name products
 * (Amazon / iHerb / Walmart availability) so we can feed each to
 * `ensureProductComplete()` and have them auto-approve into the DB.
 *
 * Voice rules match CLAUDE.md:
 *   - US audience — no "overseas / foreign / imported" framing
 *   - No prescription-only drugs
 *   - Real brands only — no made-up SKUs
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type { TopicUnderstanding } from "./types";
import type { TrendCategory } from "@/lib/trends/category-mapping";

// ── Output schema ───────────────────────────────────────────

const SuggestedProductSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(80)
    .describe(
      "Full product name including brand, as consumers would search on Amazon/iHerb. Example: 'CeraVe Moisturizing Cream', 'Paula's Choice 1% Retinol Booster', 'Nature Made Vitamin D3 2000 IU'. No made-up SKUs."
    ),
  genericName: z
    .string()
    .max(80)
    .nullable()
    .describe(
      "Active ingredient or generic name if known. Null for cosmetics without a single primary active."
    ),
  productType: z
    .enum(["otc_drug", "supplement", "cosmetic", "quasi_drug"])
    .describe(
      "otc_drug = FDA-regulated OTC medication (acetaminophen, ibuprofen, hydrocortisone). supplement = vitamins/minerals/probiotics/adaptogens. cosmetic = skincare/beauty (moisturizers, retinols, sunscreens — note: SPF products are quasi_drug in some jurisdictions, but use 'cosmetic' here). quasi_drug = medicated cosmetics like benzoyl peroxide acne washes."
    ),
  rationale: z
    .string()
    .min(10)
    .max(200)
    .describe(
      "One sentence explaining why this specific brand/product fits the article. Mention the active ingredient or feature that matches the article's recommendation."
    ),
});

export type SuggestedProduct = z.infer<typeof SuggestedProductSchema>;

const SuggestionsSchema = z.object({
  products: z.array(SuggestedProductSchema).min(1).max(5),
});

// ── Input ───────────────────────────────────────────────────

export interface SuggestTrendProductsInput {
  understanding: TopicUnderstanding;
  category: TrendCategory;
  /** Names of products already matched — avoid duplicates. */
  existingProductNames: string[];
  /** How many NEW products to suggest (cap 5). */
  count: number;
}

// ── Main ────────────────────────────────────────────────────

/**
 * Ask Gemini for N real brand-name product suggestions tailored to this
 * trend article. Returns [] on any failure — caller should treat as
 * "no fallback" and continue with whatever matchProducts returned.
 */
export async function suggestTrendProducts(
  input: SuggestTrendProductsInput
): Promise<SuggestedProduct[]> {
  const n = Math.max(1, Math.min(5, input.count));
  if (n === 0) return [];

  const { understanding, existingProductNames } = input;
  const { entities } = understanding;

  const entitiesText = [
    entities.drugs.length > 0
      ? `  drugs: ${entities.drugs.join(", ")}`
      : "",
    entities.genericIngredients.length > 0
      ? `  generic ingredients: ${entities.genericIngredients.join(", ")}`
      : "",
    entities.symptoms.length > 0
      ? `  symptoms: ${entities.symptoms.join(", ")}`
      : "",
    entities.conditions.length > 0
      ? `  conditions: ${entities.conditions.join(", ")}`
      : "",
    entities.categorySlugs.length > 0
      ? `  categories: ${entities.categorySlugs.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const existingList =
    existingProductNames.length > 0
      ? `\nAlready matched (do NOT suggest again):\n${existingProductNames.map((n) => `  - ${n}`).join("\n")}`
      : "";

  const prompt = `Trending article topic: "${understanding.originalQuery}"
Category: ${input.category}
Pharmacist's read of intent: ${understanding.intent}

Entities mentioned in the article:
${entitiesText || "  (none extracted)"}
${existingList}

Suggest ${n} real, purchasable US-retailer brand-name product${n === 1 ? "" : "s"} that fit this article's recommendation. Rules:

1) REAL products only — must exist on Amazon.com, iHerb.com, Walmart.com, or similar. No made-up SKUs. Use exact product names as they appear on retailer pages.
2) US audience — no "overseas/foreign/imported" framing. All products must be domestically available to US shoppers.
3) NO prescription-only drugs. OTC, supplements, cosmetics, or quasi-drugs only.
4) Avoid duplicates from the "Already matched" list above.
5) Prefer mainstream, pharmacist-recognized brands (CeraVe, Cetaphil, Neutrogena, Thorne, Nordic Naturals, Paula's Choice, The Ordinary, EltaMD, La Roche-Posay, NOW Foods, Nature Made, Life Extension, Jarrow, etc.).
6) Each suggestion: brand-name + specific variant. "CeraVe Moisturizing Cream" — yes. "A moisturizer" — no.
7) Match the article's actual advice. If the article discusses retinoids + sunscreen + moisturizer, suggest one of each — don't send 5 retinoids.
8) rationale field: 1 sentence connecting the brand to the article's recommendation.

Generate exactly ${n} suggestion${n === 1 ? "" : "s"}.`;

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      maxRetries: 1,
      schema: SuggestionsSchema,
      prompt,
      temperature: 0.3,
    });
    // Dedupe against existing (case-insensitive) as a safety net
    const existingLower = new Set(
      existingProductNames.map((n) => n.toLowerCase())
    );
    return object.products.filter(
      (p) => !existingLower.has(p.name.toLowerCase())
    );
  } catch (err) {
    console.warn(
      "[suggestTrendProducts] Gemini call failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

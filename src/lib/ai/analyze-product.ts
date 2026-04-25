/**
 * AI-powered product analysis: generates pros, cons, verdict,
 * ingredient analysis, comparison score, and recommended uses.
 *
 * Uses Gemini 2.5 Flash via Vercel AI SDK `generateObject`.
 * Called by the daily batch pipeline to pre-populate medication
 * detail data so real-time pages don't need AI calls.
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

// ── Zod Schema ──────────────────────────────────────────────

const ProductAnalysisSchema = z.object({
  verdict: z
    .string()
    .describe(
      "A 1-2 sentence pharmacist-style verdict summarizing who this product is best for and how effective it is."
    ),
  pros: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("3-5 clear consumer-friendly benefits."),
  cons: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("2-5 honest drawbacks or cautions."),
  ingredientAnalysis: z
    .array(
      z.object({
        name: z.string().describe("Ingredient name."),
        purpose: z
          .string()
          .describe("What this ingredient does, in plain English."),
        safetyNote: z
          .string()
          .optional()
          .describe("Any safety concern or interaction warning."),
      })
    )
    .min(1)
    .max(8)
    .describe("Key active/notable ingredients with purpose."),
  comparisonScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "Overall effectiveness/value score 0-100. 80+ is excellent, 60-79 good, 40-59 average, below 40 poor."
    ),
  scoringRationale: z
    .string()
    .describe("One sentence explaining the score."),
  recommendedFor: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe('Who should use this, e.g. "tension headaches", "sensitive skin".'),
  description: z
    .string()
    .describe(
      "A 2-3 sentence consumer-friendly product description. What it is, what it does, when to use it."
    ),
  usageGuide: z
    .object({
      howToUse: z
        .string()
        .describe(
          "1-2 sentences on WHEN and HOW to take/apply/use this product for best results. For supplements and OTC drugs, cover timing with food, dosing frequency, and absorption notes. For cosmetics, cover order of application, AM/PM, layering. Be specific, not generic. Do NOT start with 'Take' — start with the recommendation directly (e.g. 'Best taken with meals because...')."
        ),
      storage: z
        .string()
        .describe(
          "1-2 sentences on storage (light, heat, moisture, refrigeration). Only include refrigeration advice if it genuinely applies (e.g. probiotics, fish oil in hot climates)."
        ),
      precautions: z
        .string()
        .describe(
          "1-3 sentences on the most important real-world cautions: drug interactions, surgery timing, pregnancy/breastfeeding if relevant, specific populations to avoid. Name concrete interacting drugs when applicable (e.g. 'blood thinners like aspirin or warfarin'). Do not repeat information already in the main Safety section verbatim."
        ),
      tip: z
        .string()
        .optional()
        .describe(
          "Optional 1-2 sentence pharmacist tip highlighting the best-fit user profile for this product (e.g. 'This is particularly well-suited for people concerned with cardiovascular health who also experience dry eyes or mild memory concerns.'). Omit if nothing distinctive to say."
        ),
    })
    .describe(
      "Practical 'Usage Guide & Precautions' section rendered below pros/cons. Focus on real-world actionability: when to take, how to store, who to watch out for."
    ),
});

export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;

// ── System Prompt ───────────────────────────────────────────

const SYSTEM_PROMPT = `You are a licensed pharmacist (PharmD) and skincare expert writing product analyses for a consumer health website.

Rules:
- Write at an 8th-grade reading level. No jargon without explanation.
- Be honest. If evidence is weak, say so. If a product is overpriced or overhyped, say that too.
- Pros should highlight genuine benefits backed by evidence or established clinical use.
- Cons should include real drawbacks: price, side effects, drug interactions, limited evidence.
- Ingredient analysis should cover the key active ingredients and their mechanism.
- Comparison score: Be fair but honest. A basic aspirin that works great for its purpose can score 85. A trendy supplement with thin evidence might score 45.
- For OTC drugs: reference established pharmacology and FDA-approved indications.
- For supplements: note evidence quality (RCTs vs animal studies vs anecdotal).
- For cosmetics: reference dermatological evidence and ingredient concentrations where relevant.
- Always note important drug interactions or contraindications in cons.`;

// ── Main Function ───────────────────────────────────────────

export interface AnalyzeProductInput {
  name: string;
  genericName?: string | null;
  productType: string;
  category: string;
  /** FDA data if available */
  activeIngredients?: string[];
  warnings?: string | null;
  sideEffects?: string | null;
  description?: string | null;
}

/**
 * Generate a full product analysis using Gemini.
 *
 * @returns ProductAnalysis object ready to be saved to medications table
 * @throws if Gemini call fails (caller should handle retry/skip)
 */
export async function analyzeProduct(
  input: AnalyzeProductInput
): Promise<ProductAnalysis> {
  const prompt = buildPrompt(input);

  const { object } = await generateObject({
    model: google("gemini-2.5-pro"),
    maxRetries: 0,
    schema: ProductAnalysisSchema,
    system: SYSTEM_PROMPT,
    prompt,
  });

  return object;
}

// ── Prompt Builder ──────────────────────────────────────────

function buildPrompt(input: AnalyzeProductInput): string {
  const lines: string[] = [
    `Analyze this product for consumer use:`,
    ``,
    `Product: ${input.name}`,
  ];

  if (input.genericName) {
    lines.push(`Generic/Active: ${input.genericName}`);
  }

  lines.push(`Type: ${input.productType}`);
  lines.push(`Category: ${input.category}`);

  if (input.description) {
    lines.push(`\nFDA Description: ${input.description.slice(0, 500)}`);
  }

  if (input.activeIngredients?.length) {
    lines.push(`\nActive Ingredients: ${input.activeIngredients.join(", ")}`);
  }

  if (input.warnings) {
    lines.push(`\nWarnings: ${input.warnings.slice(0, 400)}`);
  }

  if (input.sideEffects) {
    lines.push(`\nSide Effects: ${input.sideEffects.slice(0, 400)}`);
  }

  lines.push(
    `\nProvide a complete consumer analysis: verdict, pros, cons, ingredient breakdown, score, and who it's best for.`
  );

  return lines.join("\n");
}

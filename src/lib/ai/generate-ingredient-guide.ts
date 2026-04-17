/**
 * AI-powered ingredient guide generator.
 *
 * Targets "What is X?" / "X benefits" / "how does X work" queries:
 *   - "niacinamide benefits"
 *   - "what is hyaluronic acid"
 *   - "retinol vs retinoid"
 *
 * Uses Gemini 2.5 Flash. Cached in ingredient_guides table.
 *
 * Voice rules:
 *   - Pharmacist-evidence tone
 *   - US audience, English only
 *   - Ground claims in peer-reviewed literature where possible
 *   - No "miracle ingredient" language
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

// ── Zod Schema ──────────────────────────────────────────────

const IngredientGuideSchema = z.object({
  hook: z
    .string()
    .describe(
      "One-paragraph plain-English definition of what this ingredient is and why people use it. 2-3 sentences."
    ),
  whatItIs: z
    .string()
    .describe("2-4 sentence explanation of the ingredient's chemistry/origin."),
  keyBenefits: z
    .array(
      z.object({
        benefit: z.string().describe("Short benefit label (4-8 words)."),
        explanation: z
          .string()
          .describe(
            "Plain-language explanation including evidence strength (e.g. 'well-studied', 'limited data')."
          ),
      })
    )
    .min(3)
    .max(6),
  howItWorks: z
    .string()
    .describe("Mechanism of action, 2-4 sentences. Approachable but accurate."),
  recommendedConcentration: z
    .string()
    .optional()
    .describe(
      "Typical effective concentration or dose range (e.g. '2-10% for skincare', '500-1000mg daily')."
    ),
  whoShouldUse: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Who benefits most from this ingredient."),
  whoShouldAvoid: z
    .array(z.string())
    .min(1)
    .max(4)
    .describe("Who should avoid or consult a doctor first."),
  sideEffects: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Common side effects or irritation patterns."),
  worksWellWith: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Compatible ingredients/actives (synergy)."),
  avoidCombiningWith: z
    .array(z.string())
    .min(1)
    .max(4)
    .describe("Ingredients that reduce effectiveness or cause irritation when combined."),
  faq: z
    .array(
      z.object({
        question: z.string().describe("Natural long-tail query."),
        answer: z.string().describe("2-3 sentence direct answer."),
      })
    )
    .min(3)
    .max(6),
  bottomLine: z
    .string()
    .describe("2-3 sentence practical takeaway — is this ingredient worth it?"),
});

export type IngredientGuide = z.infer<typeof IngredientGuideSchema>;

// ── Input ───────────────────────────────────────────────────

export interface GenerateIngredientGuideInput {
  name: string;
  /** Category hint: "supplement", "skincare", "otc_drug" */
  category?: string;
  /** Optional: products in DB that contain this ingredient */
  foundInProducts?: string[];
}

// ── Main ────────────────────────────────────────────────────

export async function generateIngredientGuide(
  input: GenerateIngredientGuideInput
): Promise<IngredientGuide> {
  const prompt = `You are a licensed US pharmacist writing an evidence-based ingredient guide for consumers.

Ingredient: ${input.name}
${input.category ? `Context: ${input.category}` : ""}
${input.foundInProducts?.length ? `Commonly found in: ${input.foundInProducts.slice(0, 8).join(", ")}` : ""}

Write a "What is ${input.name}?" guide. Rules:

1. **Evidence-based.** Distinguish between "well-studied" and "limited evidence" claims.
2. **Plain English.** Explain chemistry without dumbing it down.
3. **US audience.** No overseas framing, no jargon without explanation.
4. **No hype.** "Miracle ingredient" language is banned.
5. **Practical.** Tell readers what concentrations actually work, what to combine it with, what to avoid.
6. **FAQ = real search queries.** Match how people actually Google ("can I use X every day", "is X safe during pregnancy").

Generate all fields. Omit recommendedConcentration only if it genuinely doesn't apply.`;

  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: IngredientGuideSchema,
    prompt,
    temperature: 0.4,
  });

  return object;
}

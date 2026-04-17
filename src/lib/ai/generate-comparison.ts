/**
 * AI-powered "X vs Y" product comparison generator.
 *
 * Targets high-intent comparison queries:
 *   - "CeraVe vs Cetaphil moisturizer"
 *   - "Advil vs Tylenol for headache"
 *   - "Nature Made vs NOW Foods vitamin D"
 *
 * Uses Gemini 2.5 Flash. Cached in product_comparisons table.
 *
 * Voice rules:
 *   - Pick a winner for specific use cases (not a wishy-washy tie)
 *   - US audience, English only
 *   - Pharmacist-evidence tone (no hype, no affiliate fluff)
 *   - Ground claims in the product data passed in (ingredients, verdicts, pros/cons)
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

// ── Zod Schema ──────────────────────────────────────────────

const ComparisonSchema = z.object({
  hook: z
    .string()
    .describe(
      "One-paragraph answer to 'Which is better, A or B?'. Must pick a side OR explicitly say 'it depends on X'. 2-3 sentences."
    ),
  quickVerdict: z
    .object({
      winnerByUse: z
        .array(
          z.object({
            useCase: z
              .string()
              .describe("Short use case label, e.g. 'Sensitive skin', 'Budget pick'"),
            winner: z
              .enum(["A", "B", "Tie"])
              .describe("Which product wins for this use case."),
            why: z
              .string()
              .describe("One sentence why this product wins."),
          })
        )
        .min(3)
        .max(5),
    })
    .describe(
      "3-5 use cases, each with a clear winner (A, B, or Tie). These drive featured snippets."
    ),
  sideBySide: z
    .array(
      z.object({
        dimension: z
          .string()
          .describe("Comparison axis, e.g. 'Active ingredients', 'Price', 'Skin type'"),
        productA: z.string().describe("What product A offers for this dimension."),
        productB: z.string().describe("What product B offers for this dimension."),
      })
    )
    .min(4)
    .max(7)
    .describe("Structured side-by-side comparison across key dimensions."),
  prosCons: z.object({
    productAPros: z.array(z.string()).min(2).max(4),
    productACons: z.array(z.string()).min(1).max(3),
    productBPros: z.array(z.string()).min(2).max(4),
    productBCons: z.array(z.string()).min(1).max(3),
  }),
  bottomLine: z
    .string()
    .describe(
      "2-3 sentence practical recommendation. Tell the reader which to pick based on common scenarios."
    ),
});

export type ComparisonArticle = z.infer<typeof ComparisonSchema>;

// ── Input ───────────────────────────────────────────────────

export interface ComparisonProductInput {
  name: string;
  slug: string;
  productType: string;
  genericName?: string | null;
  activeIngredients?: string[];
  verdict?: string | null;
  pros?: string[];
  cons?: string[];
  priceRange?: string | null;
}

export interface GenerateComparisonInput {
  productA: ComparisonProductInput;
  productB: ComparisonProductInput;
}

// ── Main ────────────────────────────────────────────────────

function formatProduct(p: ComparisonProductInput, label: "A" | "B"): string {
  return `Product ${label}: ${p.name}
  Type: ${p.productType}
  ${p.genericName ? `Generic: ${p.genericName}` : ""}
  ${p.activeIngredients?.length ? `Active ingredients: ${p.activeIngredients.join(", ")}` : ""}
  ${p.verdict ? `Verdict: ${p.verdict}` : ""}
  ${p.pros?.length ? `Pros: ${p.pros.join("; ")}` : ""}
  ${p.cons?.length ? `Cons: ${p.cons.join("; ")}` : ""}
  ${p.priceRange ? `Price: ${p.priceRange}` : ""}`;
}

export async function generateComparison(
  input: GenerateComparisonInput
): Promise<ComparisonArticle> {
  const prompt = `You are a licensed US pharmacist writing a head-to-head comparison for consumers.

${formatProduct(input.productA, "A")}

${formatProduct(input.productB, "B")}

Write a "${input.productA.name} vs ${input.productB.name}" comparison. Rules:

1. **Pick winners per use case.** Don't hedge with "both are good". Specific wins drive SEO featured snippets.
2. **Ground claims in the data above.** Don't invent ingredients or features.
3. **US audience, plain English.** No jargon without explanation.
4. **Fair and evidence-based.** If one product is clearly better overall, say so — but segment by use case.
5. **Pharmacist tone.** No hype. No affiliate fluff. No "you should always consult your doctor" dodges.
6. **Practical bottom line.** End with who should pick A, who should pick B, and a "just pick one" tiebreaker.

Generate all fields of the structured output.`;

  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: ComparisonSchema,
    prompt,
    temperature: 0.4,
  });

  return object;
}

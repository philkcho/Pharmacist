/**
 * AI-powered "Is X Safe?" article generator.
 *
 * Produces structured Q&A content targeting long-tail safety queries:
 *   - "is melatonin safe every night"
 *   - "is retinol safe during pregnancy"
 *   - "can I take vitamin C with iron"
 *
 * Uses Gemini 2.5 Flash via Vercel AI SDK `generateObject`.
 * Results are cached in medications.safety_article_jsonb.
 *
 * Voice rules (apply to ALL output):
 *   - Evidence-based, pharmacist tone. No hype, no fearmongering.
 *   - Direct yes/no/conditional answers in the hook.
 *   - US audience, English only.
 *   - Cite FDA data where provided via warnings/sideEffects props.
 *   - Never claim to replace medical advice — but also don't over-disclaim.
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

// ── Zod Schema ──────────────────────────────────────────────

const SafetyArticleSchema = z.object({
  hookAnswer: z
    .string()
    .describe(
      "A single-paragraph direct answer to 'Is [product] safe?'. Start with Yes/No/Generally yes/It depends. Plain English, 2-3 sentences."
    ),
  whoShouldAvoid: z
    .array(z.string())
    .min(2)
    .max(6)
    .describe(
      "Specific groups who should avoid or consult a doctor first. E.g. 'Pregnant or breastfeeding women', 'People on blood thinners'."
    ),
  commonSideEffects: z
    .array(z.string())
    .min(2)
    .max(6)
    .describe(
      "Common side effects in plain language. Include rough frequency when known (e.g. 'Drowsiness — reported in ~1 in 10 users')."
    ),
  interactions: z
    .array(
      z.object({
        with: z.string().describe("Drug class or food (e.g. 'Blood thinners')"),
        note: z
          .string()
          .describe("One-sentence plain-language explanation of why."),
      })
    )
    .min(1)
    .max(6)
    .describe("Key drug/supplement/food interactions to watch for."),
  faq: z
    .array(
      z.object({
        question: z
          .string()
          .describe(
            "Natural long-tail search query (e.g. 'Can I take this every day?'). 4-8 words."
          ),
        answer: z
          .string()
          .describe("Direct 2-3 sentence answer, no hedging."),
      })
    )
    .min(4)
    .max(8)
    .describe(
      "Real consumer questions. MUST include at least one of: pregnancy, long-term use, alcohol, overdose, children."
    ),
  bottomLine: z
    .string()
    .describe(
      "1-2 sentence takeaway. Clear practical recommendation, not a disclaimer."
    ),
});

export type SafetyArticle = z.infer<typeof SafetyArticleSchema>;

// ── Input ───────────────────────────────────────────────────

export interface GenerateSafetyInput {
  productName: string;
  productType: string;
  genericName?: string | null;
  activeIngredients?: string[];
  fdaWarnings?: string | null;
  fdaSideEffects?: string | null;
  verdict?: string | null;
}

// ── Main ────────────────────────────────────────────────────

export async function generateSafetyArticle(
  input: GenerateSafetyInput
): Promise<SafetyArticle> {
  const fdaContext = [
    input.fdaWarnings ? `FDA Warnings: ${input.fdaWarnings}` : null,
    input.fdaSideEffects ? `FDA Side Effects: ${input.fdaSideEffects}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = `You are a licensed US pharmacist writing evidence-based safety content for consumers.

Product: ${input.productName}
${input.genericName ? `Generic name: ${input.genericName}` : ""}
Type: ${input.productType}
${input.activeIngredients?.length ? `Active ingredients: ${input.activeIngredients.join(", ")}` : ""}

${fdaContext ? `Official FDA label data:\n${fdaContext}` : ""}

${input.verdict ? `Prior pharmacist verdict: ${input.verdict}` : ""}

Write a "Is ${input.productName} Safe?" Q&A article. Rules:

1. **Direct answers.** Start the hook with Yes/No/Generally yes/It depends. No "consult your doctor" dodges.
2. **Plain language.** A high-school graduate should understand every sentence.
3. **FDA-backed when relevant.** If FDA data is provided, weight those warnings appropriately.
4. **US audience.** No overseas/foreign framing. No K-beauty unless relevant.
5. **Real search queries.** FAQ questions should match how people actually Google — not how textbooks phrase them.
6. **Cover the big 5.** FAQ must address at least one of: pregnancy/breastfeeding, long-term daily use, alcohol, overdose/too-much, children/age limits.
7. **No fearmongering or hype.** Calibrate confidence to evidence.
8. **Practical bottom line.** End with what a normal person should actually do.

Generate all fields of the structured output.`;

  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: SafetyArticleSchema,
    prompt,
    temperature: 0.4,
  });

  return object;
}

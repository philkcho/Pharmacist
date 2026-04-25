import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const productAnalysisSchema = z.object({
  verdict: z
    .string()
    .describe("1-2 sentence pharmacist verdict — what makes this product stand out"),
  pros: z
    .array(z.string())
    .min(3)
    .max(6)
    .describe("3-6 bullet points highlighting benefits"),
  cons: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("2-5 bullet points with cautions or downsides"),
  ingredientAnalysis: z
    .array(
      z.object({
        name: z.string().describe("Ingredient name (e.g. 'Hyaluronic Acid', 'Niacinamide')"),
        consumer: z.object({
          whatItDoes: z.string().describe("Plain-English explanation in 1-2 sentences"),
          howFast: z.string().describe("How quickly you'll see results (e.g. 'within 2 weeks')"),
          whoItsFor: z.string().describe("Best skin types or users"),
          maxPerDay: z.string().describe("Usage frequency (e.g. 'twice daily')"),
          whenToAvoid: z
            .array(z.string())
            .describe("Situations or conditions where this should be avoided"),
        }),
        professional: z.object({
          mechanism: z.string().describe("Technical mechanism of action"),
          clinicalNotes: z.string().describe("Clinical evidence and notes for professionals"),
        }),
      })
    )
    .min(2)
    .max(5)
    .describe("2-5 key active ingredients with dual-layer analysis"),
  recommendedFor: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Who should consider using this product"),
  usageGuide: z
    .object({
      howToUse: z
        .string()
        .describe(
          "1-2 sentences on WHEN and HOW to take/apply/use for best results. Be specific (timing with food, dosing, order of application, AM/PM), not generic."
        ),
      storage: z
        .string()
        .describe(
          "1-2 sentences on storage (light, heat, moisture, refrigeration). Include refrigeration only when it genuinely matters (e.g. probiotics, fish oil)."
        ),
      precautions: z
        .string()
        .describe(
          "1-3 sentences on real-world cautions: drug interactions (name concrete drugs), surgery timing, pregnancy/breastfeeding if relevant, populations to avoid. Do not repeat content from the main Safety section verbatim."
        ),
      tip: z
        .string()
        .optional()
        .describe(
          "Optional 1-2 sentence pharmacist tip highlighting the best-fit user profile. Omit if nothing distinctive to add."
        ),
    })
    .describe(
      "Practical 'Usage Guide & Precautions' section shown below pros/cons on the analysis page."
    ),
});

export type ProductAnalysisResult = z.infer<typeof productAnalysisSchema>;

/**
 * Generate a comprehensive product analysis using Gemini.
 * Returns structured ingredient analysis, pros/cons, and pharmacist verdict.
 */
export async function generateProductAnalysis(
  productName: string,
  productType: string,
  description?: string | null
): Promise<ProductAnalysisResult> {
  const { object } = await generateObject({
    model: google("gemini-2.5-pro"),
    schema: productAnalysisSchema,
    prompt: `You are a pharmacist writing a product analysis for a health & beauty website targeting 20-30 year old Americans.

Product: ${productName}
Type: ${productType}
${description ? `Description: ${description}` : ""}

Write a comprehensive but consumer-friendly analysis. Guidelines:
- Tone: conversational but authoritative, like a smart friend who happens to be a pharmacist
- Verdict: short and punchy — what makes this worth (or not worth) buying
- Pros/Cons: specific and honest, not generic
- Ingredient analysis: focus on 2-5 key active ingredients that actually matter for effectiveness
- Consumer layer: plain English, no jargon
- Professional layer: mechanism + clinical evidence for healthcare providers
- Be honest — if something is mid or has downsides, say so`,
  });

  return object;
}

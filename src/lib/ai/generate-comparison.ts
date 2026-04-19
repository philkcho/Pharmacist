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
import {
  fetchArticleReferences,
  extractLikelyIngredient,
  type ArticleReference,
} from "@/lib/references/fetch-references";

// ── Zod Schema ──────────────────────────────────────────────

const ComparisonSchema = z.object({
  hook: z
    .string()
    .describe(
      "One-paragraph answer to 'Which is better, A or B?'. Must pick a side OR explicitly say 'it depends on X'. 2-3 sentences."
    ),
  quickVerdict: z.object({
    winnerByUse: z
      .array(
        z.object({
          useCase: z.string(),
          winner: z
            .string()
            .describe("Must be exactly one of: A, B, or Tie"),
          why: z.string(),
        })
      )
      .min(1)
      .max(10),
  }),
  sideBySide: z
    .array(
      z.object({
        dimension: z.string(),
        productA: z.string(),
        productB: z.string(),
      })
    )
    .min(2)
    .max(12),
  prosCons: z.object({
    productAPros: z.array(z.string()).min(1).max(10),
    productACons: z.array(z.string()).max(10),
    productBPros: z.array(z.string()).min(1).max(10),
    productBCons: z.array(z.string()).max(10),
  }),
  bottomLine: z
    .string()
    .describe(
      "2-3 sentence practical recommendation. Tell the reader which to pick based on common scenarios."
    ),
});

type ComparisonArticleAiOutput = z.infer<typeof ComparisonSchema>;

// AI output + retrieved references. `references` is optional so cached
// comparisons generated before this feature landed still satisfy the
// type.
export type ComparisonArticle = ComparisonArticleAiOutput & {
  references?: ArticleReference[];
};

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

// Build combined reference set covering both products. PubMed primary
// term is whichever product has structured generic info first; all
// brand + generic terms feed the FDA lookup which dedups internally.
export async function fetchComparisonReferences(
  input: GenerateComparisonInput
): Promise<ArticleReference[]> {
  const products = [input.productA, input.productB];
  const genericsPerProduct = products.map((p) =>
    [p.genericName, ...(p.activeIngredients ?? [])].filter(
      (v): v is string => typeof v === "string" && v.length > 0
    )
  );
  const extractedPerProduct = products.map((p) =>
    extractLikelyIngredient(p.name)
  );

  const primaryTerm =
    genericsPerProduct[0][0] ??
    extractedPerProduct[0] ??
    genericsPerProduct[1][0] ??
    extractedPerProduct[1] ??
    input.productA.name;

  const fallbackTerms = Array.from(
    new Set(
      [
        ...genericsPerProduct[0].slice(1),
        ...genericsPerProduct[1],
        ...extractedPerProduct.filter((e): e is string => !!e),
      ].filter((t) => t !== primaryTerm)
    )
  );

  const drugTerms = Array.from(
    new Set(
      [
        input.productA.name,
        input.productB.name,
        ...genericsPerProduct[0],
        ...genericsPerProduct[1],
        ...extractedPerProduct.filter((e): e is string => !!e),
      ].filter((v) => !!v && v.length > 0)
    )
  );

  return fetchArticleReferences({
    primaryTerm,
    fallbackTerms,
    drugTerms,
    limit: 6,
  });
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

  const referencesPromise = fetchComparisonReferences(input);

  try {
    const [{ object }, references] = await Promise.all([
      generateObject({
        model: google("gemini-2.5-flash"),
        schema: ComparisonSchema,
        prompt,
        temperature: 0.4,
      }),
      referencesPromise,
    ]);
    return { ...object, references };
  } catch (err) {
    const detail = summarizeAiError(err);
    console.error(
      `[comparison] FAILED ${input.productA.slug}-vs-${input.productB.slug}: ${detail}`,
    );
    throw err;
  }
}

function summarizeAiError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const parts: string[] = [err.message];
  const anyErr = err as Error & { cause?: unknown; text?: string };
  if (anyErr.cause instanceof Error) {
    parts.push(`cause=${anyErr.cause.message}`);
  }
  if (typeof anyErr.text === "string") {
    parts.push(`text=${anyErr.text.slice(0, 400)}`);
  }
  return parts.join(" | ");
}

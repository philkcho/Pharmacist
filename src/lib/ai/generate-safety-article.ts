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
import { searchPubmed } from "@/lib/retrieval/search-pubmed";
import { emptyEntities, type SourceFragment } from "@/lib/ai/types";

// ── Zod Schema ──────────────────────────────────────────────

// Public-shaped citation persisted alongside the article. We store the
// retrieved SourceFragment subset that actually renders on the page —
// avoids leaking the full retrieval metadata into JSONB and keeps the
// type stable across future retriever refactors.
export interface SafetyReference {
  title: string;
  url: string;
  kind: "pubmed" | "fda";
  citation?: string;
  year?: string;
}

const SafetyArticleSchema = z.object({
  hookAnswer: z
    .string()
    .describe(
      "A single-paragraph direct answer to 'Is [product] safe?'. Start with Yes/No/Generally yes/It depends. Plain English, 2-3 sentences."
    ),
  whoShouldAvoid: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe(
      "Specific groups who should avoid or consult a doctor first. E.g. 'Pregnant or breastfeeding women', 'People on blood thinners'."
    ),
  commonSideEffects: z
    .array(z.string())
    .min(1)
    .max(10)
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
    .max(10)
    .describe(
      "Key drug/supplement/food interactions. Return an empty array for topical cosmetics with no systemic interactions.",
    ),
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
    .min(3)
    .max(12)
    .describe(
      "Real consumer questions. For oral products include at least one of: pregnancy, long-term use, alcohol, overdose, children. For topical products cover pregnancy/breastfeeding, layering with other actives, and skin-type suitability."
    ),
  bottomLine: z
    .string()
    .describe(
      "1-2 sentence takeaway. Clear practical recommendation, not a disclaimer."
    ),
});

type SafetyArticleAiOutput = z.infer<typeof SafetyArticleSchema>;

// What we actually persist and render — the AI output plus retrieved
// references (populated outside the AI call to guarantee real URLs,
// never hallucinated). `references` is optional so older cached
// articles generated before this change still satisfy the type.
export type SafetyArticle = SafetyArticleAiOutput & {
  references?: SafetyReference[];
};

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
6. **FAQ coverage.** Oral products: include at least one of pregnancy/breastfeeding, long-term daily use, alcohol, overdose, or children. Topical cosmetics: cover pregnancy safety, layering with other actives (retinol/AHA/BHA/vitamin C), and skin-type suitability.
   **Interactions.** Oral products: include relevant drug/food interactions. Topical cosmetics with no systemic absorption: it's fine to return an empty interactions array.
7. **No fearmongering or hype.** Calibrate confidence to evidence.
8. **Practical bottom line.** End with what a normal person should actually do.

Generate all fields of the structured output.`;

  // Fetch real peer-reviewed references in parallel with AI generation.
  // PubMed URLs are real — we never ask Gemini to invent them, which
  // eliminates the citation-hallucination risk that plagues AI health
  // content. Failure is non-fatal: the article still publishes, just
  // without a References section.
  const referencesPromise = fetchSafetyReferences(input);

  try {
    const [{ object }, references] = await Promise.all([
      generateObject({
        model: google("gemini-2.5-flash"),
        schema: SafetyArticleSchema,
        prompt,
        temperature: 0.4,
      }),
      referencesPromise,
    ]);
    return { ...object, references };
  } catch (err) {
    const detail = summarizeAiError(err);
    console.error(
      `[safety-article] FAILED ${input.productName} (${input.productType}): ${detail}`,
    );
    throw err;
  }
}

// ── References ─────────────────────────────────────────────
//
// Drives PubMed (review articles first) off the product's generic and
// active ingredients — falls back to the brand name if neither is set.
// Fragment → SafetyReference mapping strips internal retrieval fields
// we don't want frozen in JSONB.

async function fetchSafetyReferences(
  input: GenerateSafetyInput
): Promise<SafetyReference[]> {
  const generics = [
    input.genericName,
    ...(input.activeIngredients ?? []),
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  // Build progressively simpler queries. PubMed's review-article filter
  // is strict — a full brand name like "Doctor's Best Pure Vitamin C
  // Powder with Quali-C" returns zero hits, so we retry with just the
  // generic ingredient or a keyword extracted from the brand name.
  const candidates: { query: string; entities: typeof emptyEntities extends () => infer T ? T : never }[] = [];

  if (generics.length > 0) {
    candidates.push({
      query: generics[0],
      entities: { ...emptyEntities(), genericIngredients: generics },
    });
  }

  const extracted = extractLikelyIngredient(input.productName);
  if (extracted && !generics.includes(extracted)) {
    candidates.push({
      query: extracted,
      entities: { ...emptyEntities(), genericIngredients: [extracted] },
    });
  }

  for (const c of candidates) {
    try {
      const { fragments } = await searchPubmed({ ...c, limit: 6 });
      if (fragments.length > 0) {
        return fragments.slice(0, 6).map(fragmentToReference);
      }
    } catch (err) {
      console.warn(
        "[safety-article] reference fetch failed:",
        err instanceof Error ? err.message : err
      );
    }
  }
  return [];
}

// Lightweight ingredient-name guesser for products without structured
// genericName or activeIngredients. Covers the ~30 most common OTC /
// supplement ingredients we stock — good enough for PubMed search
// fallback without adding an LLM call.
const COMMON_INGREDIENT_TERMS = [
  "vitamin c",
  "vitamin d",
  "vitamin e",
  "vitamin k",
  "vitamin b12",
  "vitamin a",
  "omega-3",
  "fish oil",
  "probiotics",
  "melatonin",
  "magnesium",
  "zinc",
  "iron",
  "calcium",
  "biotin",
  "collagen",
  "glucosamine",
  "turmeric",
  "curcumin",
  "ashwagandha",
  "ginseng",
  "coq10",
  "niacinamide",
  "hyaluronic acid",
  "retinol",
  "retinoid",
  "salicylic acid",
  "glycolic acid",
  "azelaic acid",
  "benzoyl peroxide",
  "acetaminophen",
  "ibuprofen",
  "naproxen",
  "aspirin",
  "diphenhydramine",
  "loratadine",
  "cetirizine",
  "famotidine",
  "omeprazole",
  "melatonin",
  "creatine",
  "ashwagandha",
  "spermidine",
];

function extractLikelyIngredient(name: string): string | null {
  const lower = name.toLowerCase();
  for (const term of COMMON_INGREDIENT_TERMS) {
    if (lower.includes(term)) return term;
  }
  return null;
}

function fragmentToReference(f: SourceFragment): SafetyReference {
  const isFda = f.sourceType.startsWith("fda_");
  return {
    title: f.title,
    url: f.url,
    kind: isFda ? "fda" : "pubmed",
    citation: f.citation,
    year: f.publishedAt,
  };
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

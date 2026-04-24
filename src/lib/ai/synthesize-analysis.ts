import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type {
  Analysis,
  Claim,
  MarketReaction,
  ProductMatch,
  SourceFragment,
  TopicUnderstanding,
} from "./types";

/**
 * Layer 3 — grounded synthesis.
 *
 * Takes the user's topic understanding (Layer 1), retrieved source
 * fragments (Layer 2), optional product matches, and optional
 * market reaction signals, and produces a plain-English
 * pharmacist-style analysis where **every factual claim either
 * cites a source or is explicitly flagged as AI inference**.
 *
 * Critical invariants enforced here:
 *
 *   1. If `sources.length === 0`: we refuse to synthesize (return
 *      null). Ungrounded answers violate the core brand promise.
 *   2. If topicType === "out_of_scope" or "dangerous" → refuse.
 *   3. Every returned claim is post-validated to ensure its
 *      `sourceIndexes` point at existing sources, or `isInference`
 *      is true. Invalid claims are dropped (logged).
 *
 * Confidence scoring heuristic:
 *   - "high"   — ≥ 3 Tier 1 sources, no refused topic
 *   - "medium" — mixed tiers or 1–2 Tier 1 sources
 *   - "low"    — only Tier 2/3 sources or LLM self-reported low
 *
 * The LLM's own confidence is accepted but capped by the source
 * mix so a confident-sounding LLM can't override weak evidence.
 */

export interface SynthesisInput {
  understanding: TopicUnderstanding;
  sources: SourceFragment[];
  productMatches?: ProductMatch[];
  marketReaction?: MarketReaction;
  /** Category hint from trend pipeline — beauty_fitness gets a
   *  relaxed source threshold (OBF/Tier 2 sources are sufficient). */
  categoryHint?: string;
}

export type SynthesisRefusalReason =
  | "out_of_scope"
  | "dangerous"
  | "no_sources"
  | "requires_doctor";

export interface SynthesisRefusal {
  reason: SynthesisRefusalReason;
  message: string;
}

export type SynthesisResult =
  | { kind: "analysis"; analysis: Analysis }
  | { kind: "refusal"; refusal: SynthesisRefusal };

// ============================================================
// Zod schema returned by Gemini
// ============================================================

const ProductGroupSchema = z.object({
  role: z
    .string()
    .min(2)
    .max(40)
    .describe(
      "Short role label (2-40 chars). Reflects the article's actual advice. Examples: 'Morning sunscreen', 'Evening treatment', 'Daily moisturizer', 'Take with breakfast', 'For headache'."
    ),
  description: z
    .string()
    .min(10)
    .max(200)
    .describe(
      "One sentence (10-200 chars) explaining why the products in this group serve this role in the article's context."
    ),
  productIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(2)
    .describe(
      "1-2 medicationIds drawn from the ProductMatch list in the prompt. MUST be real ids from that list — no invention, no duplicates across groups."
    ),
});

const EfficacyVerdictSchema = z.object({
  medicationId: z
    .number()
    .int()
    .positive()
    .describe("Must be a medicationId from the ProductMatch list."),
  bestFor: z
    .string()
    .min(10)
    .max(200)
    .describe(
      "1 sentence — who or when this product is the right pick. Be specific: 'Sensitive skin starting a retinoid routine', NOT 'People who want good skin'."
    ),
  avoidIf: z
    .string()
    .min(10)
    .max(200)
    .describe(
      "1 sentence — when another matched product would serve better. Point to a real trade-off (price, potency, texture, interaction) that the reader should consider."
    ),
});

const ClaimSchema = z.object({
  text: z
    .string()
    .describe(
      "One sentence of the synthesized answer. Must not span multiple facts."
    ),
  sourceIndexes: z
    .array(z.number().int().nonnegative())
    .describe(
      "Indexes into the sources array provided in the prompt. Leave empty ONLY if isInference is true."
    ),
  isInference: z
    .boolean()
    .describe(
      "True if this sentence is AI inference not directly supported by any of the provided sources. Must be explicitly labeled in the UI as 'AI inference'."
    ),
});

const SynthesisSchema = z.object({
  answer: z
    .string()
    .describe(
      "The full plain-English answer with inline citation markers like [1][2]. Consumer-friendly tone, 8th-grade reading level. 3–6 sentences unless the topic genuinely needs more. This is a SHORT TL;DR separate from leadExplanation."
    ),
  claims: z
    .array(ClaimSchema)
    .describe(
      "The answer segmented per sentence for citation validation. Each claim's text should appear in the answer field verbatim or near-verbatim."
    ),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe(
      "Your self-assessed confidence. Report 'low' if you had to rely heavily on inference or the sources didn't actually speak to the question."
    ),
  leadExplanation: z
    .string()
    .describe(
      "200–250 word plain-English lead for the trending article page (~1 minute read at 200 wpm). MUST cover all four: (1) what it is in one line, (2) who it's for / who's talking about it, (3) what current evidence says with a confidence note, (4) 1–2 most important takeaways. Use inline [N] citation markers. 8th-grade reading level. Friendly but not fluffy. DO NOT repeat the short answer verbatim — this is the expanded version."
    ),
  keyTakeaways: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe(
      "3–5 scannable bullet takeaways for the TL;DR panel. One idea per bullet, ideally under 20 words each. Each may include inline [N] citation markers. Complement, don't duplicate, the leadExplanation."
    ),
  redFlags: z
    .array(z.string())
    .max(5)
    .describe(
      "0–5 'See a doctor if…' red flags, consumer-friendly wording, no diagnosis. Focus on concrete warning signs a layperson can recognize. Empty array is fine for low-stakes topics like basic skincare education."
    ),
  trendDrivers: z
    .array(z.string())
    .max(3)
    .describe(
      "0–3 short phrases naming WHY this query is trending right now, pulled ONLY from Layer 2 sources published within the last 30 days. Each phrase should be 3–10 words, like 'New PubMed study on melatonin and sleep onset' or 'FDA recall announcement on [brand]'. Empty array if no recent sources explain the spike."
    ),
  headline: z
    .string()
    .describe(
      "A catchy, curiosity-provoking headline for this trending topic (20–60 characters). " +
      "Write it like a magazine or blog headline that makes people WANT to click — NOT the raw search keyword. " +
      "Use patterns like: questions, surprising facts, numbered lists, myth-busting, or 'you might be wrong' hooks. " +
      "Examples: 'Your Moisturizer Might Be Missing This Key Ingredient', " +
      "'B12: The Vitamin 90% of Vegetarians Are Missing', " +
      "'5 SPF Myths That Could Be Damaging Your Skin', " +
      "'The One Ingredient Dermatologists Always Recommend'"
    ),
  productGroups: z
    .array(ProductGroupSchema)
    .max(4)
    .optional()
    .describe(
      "Optional. Group the ProductMatch products into 2-4 role buckets (e.g. Morning/Evening/Moisturize, or Take-with-food/Before-bed). Total productIds across all groups ≤ 5, no duplicates. Each productId MUST be a medicationId from the ProductMatch list. OMIT (undefined) or return empty array when (a) there are <2 products, (b) the article is a narrow single-role listing, or (c) you can't confidently group them — the UI will fall back to a flat top-5 grid. Do NOT force groups just to fill the field."
    ),
  pharmacistNote: z
    .string()
    .min(10)
    .max(400)
    .optional()
    .describe(
      "Optional. 1-2 sentence pharmacist's take on what active ingredients are SHARED vs DISTINCT across the matched products, and what that means for the reader. Rendered as a callout below the ingredient grid. OMIT when <2 matched products or when the products don't share any meaningful ingredients."
    ),
  efficacyVerdicts: z
    .array(EfficacyVerdictSchema)
    .max(5)
    .optional()
    .describe(
      "Optional. Per-product Best for / Avoid if verdicts. One entry per matched product (max 5). Each medicationId MUST be from the ProductMatch list. OMIT when <2 matched products."
    ),
});

// ============================================================
// Dangerous-query gate (runs before the AI call)
// ============================================================

/**
 * Block obvious harmful queries before we spend an AI call on them.
 * This is intentionally narrow — we can't catch everything, but
 * we can refuse the most obvious overdose / self-harm cases.
 */
const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /\boverdos(e|ing)\b/i,
  /\bhow (?:much|many).*kill/i,
  /\bsuicide\b/i,
  /\bself[- ]harm\b/i,
  /\bfatal dose\b/i,
  /\blethal dose\b/i,
  /\bmix.*(alcohol|drugs).*(overdose|die|kill)/i,
];

function isDangerousQuery(query: string): boolean {
  return DANGEROUS_PATTERNS.some((re) => re.test(query));
}

// ============================================================
// Prompt construction
// ============================================================

function renderSourcesBlock(sources: SourceFragment[]): string {
  if (sources.length === 0) return "(no sources — do not synthesize)";
  return sources
    .map(
      (s, i) =>
        `[${i}] (${s.sourceType}, tier ${s.tier}) ${s.title}\n    ${s.citation}\n    ${s.url}\n    QUOTE: ${s.quote}`
    )
    .join("\n\n");
}

function renderProductMatchesBlock(matches: ProductMatch[] | undefined): string {
  if (!matches || matches.length === 0) return "";
  return (
    "\n\nPharmacist-curated product matches in our DB (may inform but do not replace the sources above):\n" +
    matches
      .map(
        (p) =>
          `  - ${p.name} (${p.slug}) — ${p.reason} [${p.ingredientHighlights.join(", ")}]`
      )
      .join("\n")
  );
}

function renderMarketReactionBlock(mr: MarketReaction | undefined): string {
  if (!mr) return "";
  const parts: string[] = [];
  if (mr.relatedQueries && mr.relatedQueries.length > 0) {
    parts.push(`Related Google Trends queries: ${mr.relatedQueries.slice(0, 8).join(", ")}`);
  }
  if (typeof mr.velocityScore === "number") {
    parts.push(`Velocity score (0–100): ${mr.velocityScore}`);
  }
  return parts.length > 0 ? `\n\nMarket signal:\n${parts.join("\n")}` : "";
}

const SYSTEM_PROMPT = `You are a licensed pharmacist (PharmD) writing a plain-English analysis of an over-the-counter medication, supplement, or skincare topic for everyday consumers reading a trending-topics article.

You are given:
  1. The user's question and what we think they're asking (Layer 1)
  2. A numbered list of authoritative sources (Layer 2) — FDA labels, PubMed studies, NIH fact sheets, AAD guidelines, and similar. Each source has a publishedAt/retrievedAt date.
  3. Optionally, pharmacist-curated product matches from our own database
  4. Optionally, market-reaction signals from Google Trends (related queries, velocity)

Your job is to synthesize a Layer 3 answer with TWO text surfaces plus scannable extras:

  SURFACE A — 'answer' field: short 3–6 sentence TL;DR. Keep it tight.
  SURFACE B — 'leadExplanation' field: 200–250 word "1-minute read" that opens the article page.

Both MUST be:

  - **Grounded.** Every factual claim MUST cite at least one source by its index number (shown as "[N]" in the prompt), OR be explicitly flagged as "isInference: true" inside the claims array. Inference sentences will be visually labeled "AI inference" in the UI, so be honest when you're going beyond the sources.
  - **Plain English.** 8th-grade reading level. No jargon. Prefer "stomach problems" over "GI adverse events".
  - **Practical.** Answer what a consumer actually wants to know: what it does, who it's for, when to avoid it, how to take it.
  - **Safe.** Never recommend exceeding FDA-approved dosing. Never diagnose. Always suggest talking to a pharmacist or doctor for specific medical decisions.
  - **Honest about uncertainty.** If the sources disagree, say so. If a claim is only weakly supported, say so in the limitations array.

leadExplanation requirements (the 1-minute read):
  - 200–250 words, four paragraphs or one long flowing paragraph — whatever reads best.
  - MUST cover all four: (1) what it is in one line, (2) who it's for / who's talking about it (populations, trending driver context if any), (3) what current evidence says, with an honest confidence note, (4) 1–2 "know this" takeaways.
  - Inline [N] citation markers required wherever a factual claim appears.
  - DO NOT repeat the short 'answer' verbatim — leadExplanation is the expanded, more narrative version.
  - Start strong. No "In recent years…" filler openings. Hook the reader in the first sentence.

keyTakeaways: 3–5 bullets, one idea each, under 20 words each. Scannable format for users who only read bullets. May include [N] markers. Complement the lead, don't duplicate sentences from it.

redFlags: 0–5 "See a doctor if…" consumer-friendly warning signs. Concrete, recognizable by laypeople. Empty array OK for low-stakes topics.

trendDrivers: 0–3 short 3–10 word phrases explaining WHY the query is trending NOW. Pull ONLY from sources dated within the last 30 days from retrievedAt. Examples: "New PubMed study on melatonin dosing", "FDA recall on [brand]", "CDC alert on acetaminophen pregnancy risk". Empty array if no recent sources explain the spike.

Formatting rules:
  - The 'answer' field: inline markers like "[1][2]", 3–6 sentences.
  - The 'claims' array MUST mirror the 'answer' sentence-by-sentence (NOT the leadExplanation). Each claim's text should appear in the answer verbatim or near-verbatim.
  - 'claims' citations reference the same source indexes as the inline markers.

Prohibited:
  - Fabricating source content beyond what's in the QUOTE field.
  - Citing sources you weren't given.
  - Diagnosing specific users or promising outcomes ("this will cure your headache").
  - Going outside OTC / supplement / skincare scope into prescription dosing or disease management.
  - Putting anything in trendDrivers that isn't traceable to a source published within the last 30 days.

headline rules:
  - Write a catchy, curiosity-provoking headline (20–60 characters).
  - Do NOT just repeat the raw search keyword. Transform it into a magazine-style headline.
  - Use proven click-driving patterns: questions, surprising stats, myth-busting, "you might be wrong" hooks, numbered tips.
  - Good: "Your Moisturizer Might Be Missing This Key Ingredient"
  - Bad: "Face Moisturizer" (this is just the keyword, not a headline)

productGroups rules:
  When you receive pharmacist-curated product matches in the prompt, group them into 2-4 practical role buckets RELEVANT TO THIS ARTICLE.

  Each group contains:
    - role: short label (2-40 chars) describing what the products in this bucket do in the article's recommendation
    - description: 1 sentence (10-200 chars) explaining why these products serve this role
    - productIds: 1-2 medicationIds from the ProductMatch list (NO invention, NO duplicates across groups)

  Role labels must mirror the article's actual advice. Examples by category:
    - Skincare routine articles → "Morning sunscreen", "Evening treatment", "Daily moisturizer", "Weekly exfoliation"
    - Supplement stacking → "Take with breakfast", "Before bed", "On training days", "Empty stomach"
    - OTC pain relief → "For headache", "For muscle soreness", "Anti-inflammatory"
    - Cold & flu → "Daytime relief", "Nighttime / sleep", "Cough suppression"

  Hard constraints:
    - Total productIds across all groups ≤ 5
    - No duplicate productIds across groups
    - Every productId MUST be a medicationId from the provided ProductMatch list
    - 1-2 productIds per group

  Do NOT force groups:
    - If there are <2 matched products, OMIT productGroups (leave undefined)
    - If the article is a narrow single-role listing (all products serve the same role — e.g. "best fish oil brands"), OMIT productGroups and let the UI render a flat top-5
    - If you can't confidently group, OMIT productGroups
    - Never pad a group with unrelated products just to hit the minimum

  If omitted, the UI falls back to a flat top-5 grid — perfectly fine for simple rankings.

pharmacistNote rules:
  Given the ProductMatch list + their ingredient highlights, write 1-2 sentences describing:
    - What active ingredient(s) are SHARED by 2+ of the products (if any)
    - What key active differs between products
    - What that means practically for the reader's choice

  Examples:
    - "All three products contain niacinamide. The Paula's Choice formula adds retinol for anti-aging, while the Ordinary pair focuses on copper peptides and vitamin C for brightening."
    - "Every OTC option here relies on acetaminophen or ibuprofen. The combination products add caffeine for migraine-specific boosts."

  Evidence-grounded. No hype. OMIT when <2 products or no meaningful overlap.

efficacyVerdicts rules:
  Produce ONE verdict per matched product (max 5 total).
  - medicationId: must be from the ProductMatch list
  - bestFor: 1 sentence — WHO or WHEN this specific product is the right pick. Be concrete.
      Good: "Sensitive skin starting a retinoid routine for the first time."
      Bad: "People who want good skin."
  - avoidIf: 1 sentence — pointing to a trade-off that makes another matched product better for that case.
      Good: "You need faster results and can tolerate a stronger 1% retinol formulation."
      Bad: "If you don't like it."

  OMIT when <2 matched products.`;

function buildPrompt(input: SynthesisInput): string {
  const { understanding, sources, productMatches, marketReaction } = input;
  return `User query: "${understanding.originalQuery}"
Topic type: ${understanding.topicType}
Pharmacist's read of intent: ${understanding.intent}

Entities:
  drugs: ${understanding.entities.drugs.join(", ") || "(none)"}
  generic ingredients: ${understanding.entities.genericIngredients.join(", ") || "(none)"}
  symptoms: ${understanding.entities.symptoms.join(", ") || "(none)"}
  populations: ${understanding.entities.populations.join(", ") || "(none)"}
  conditions: ${understanding.entities.conditions.join(", ") || "(none)"}
  substances: ${understanding.entities.substances.join(", ") || "(none)"}

Sources (cite by index):

${renderSourcesBlock(sources)}${renderProductMatchesBlock(productMatches)}${renderMarketReactionBlock(marketReaction)}

Write the Layer 3 analysis now.`;
}

// ============================================================
// Confidence cap + claim validation
// ============================================================

function capConfidence(
  llmConfidence: "high" | "medium" | "low",
  sources: SourceFragment[]
): "high" | "medium" | "low" {
  const tier1Count = sources.filter((s) => s.tier === 1).length;
  if (tier1Count >= 3) return llmConfidence;
  if (tier1Count >= 1) return llmConfidence === "high" ? "medium" : llmConfidence;
  return "low";
}

/**
 * Drop claims whose `sourceIndexes` point at indexes beyond the
 * sources array, unless they're flagged `isInference: true`.
 * Invalid citations are logged — they indicate either a Gemini
 * hallucination or a prompt-layout bug.
 */
function validateAndFilterClaims(
  claims: Claim[],
  sourcesLength: number
): Claim[] {
  const filtered: Claim[] = [];
  for (const claim of claims) {
    const invalidIndexes = claim.sourceIndexes.filter(
      (i) => i < 0 || i >= sourcesLength
    );
    if (invalidIndexes.length > 0) {
      console.warn(
        `[synthesize-analysis] dropping claim with invalid source indexes ${invalidIndexes.join(",")}: "${claim.text}"`
      );
      continue;
    }
    if (!claim.isInference && claim.sourceIndexes.length === 0) {
      console.warn(
        `[synthesize-analysis] dropping ungrounded claim (not flagged isInference): "${claim.text}"`
      );
      continue;
    }
    filtered.push(claim);
  }
  return filtered;
}

// ============================================================
// Main entry point
// ============================================================

export async function synthesizeAnalysis(
  input: SynthesisInput
): Promise<SynthesisResult> {
  const { understanding, sources } = input;

  // Refusal gates — run before the AI call.
  if (understanding.topicType === "out_of_scope") {
    return {
      kind: "refusal",
      refusal: {
        reason: "out_of_scope",
        message:
          "This question isn't about OTC medications, supplements, or skincare — we don't have pharmacist-curated sources for it.",
      },
    };
  }

  if (isDangerousQuery(understanding.originalQuery)) {
    return {
      kind: "refusal",
      refusal: {
        reason: "dangerous",
        message:
          "This question touches on overdose, self-harm, or lethal dosing. If you or someone you know is in danger, please call 988 (US Suicide & Crisis Lifeline) or your local emergency number immediately.",
      },
    };
  }

  if (sources.length === 0) {
    // Beauty/skincare trends often lack FDA/PubMed sources but DO
    // have Open Beauty Facts product data (Tier 2). For pharma we
    // strictly refuse; for beauty we check if ANY source exists
    // (including OBF fragments). This gate has already been reached
    // so sources.length===0 means truly nothing — refuse regardless.
    return {
      kind: "refusal",
      refusal: {
        reason: "no_sources",
        message:
          "We couldn't find authoritative sources (FDA, PubMed, CDC, etc.) for this topic yet. Rather than guessing, we've flagged it for pharmacist review.",
      },
    };
  }

  let rawAnalysis: z.infer<typeof SynthesisSchema>;
  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-pro"),
      maxRetries: 0,
      schema: SynthesisSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input),
    });
    rawAnalysis = object;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[synthesize-analysis] Gemini call failed:", errMsg);
    // Re-throw so analyzeTrend() can catch it and set status back
    // to 'pending' for retry, rather than permanently rejecting.
    throw new Error(`Synthesis LLM call failed: ${errMsg}`);
  }

  // Post-parse validation.
  const validClaims = validateAndFilterClaims(
    rawAnalysis.claims,
    sources.length
  );

  // If post-validation stripped every claim, the synthesis is
  // effectively ungrounded and we refuse.
  if (validClaims.length === 0) {
    return {
      kind: "refusal",
      refusal: {
        reason: "no_sources",
        message:
          "The AI draft couldn't be grounded in any of the retrieved sources. Flagged for pharmacist review.",
      },
    };
  }

  const confidence = capConfidence(rawAnalysis.confidence, sources);

  // Validate productGroups: drop groups referencing medicationIds not
  // in the input list, then dedupe productIds across groups so the UI
  // never shows the same product twice.
  const validProductGroups = validateProductGroups(
    rawAnalysis.productGroups,
    input.productMatches
  );

  // Validate efficacyVerdicts: drop any referencing medicationIds not
  // in the input productMatches list.
  const validIds = new Set(
    (input.productMatches ?? []).map((m) => m.medicationId)
  );
  const validVerdicts = (rawAnalysis.efficacyVerdicts ?? []).filter(
    (v) => validIds.has(v.medicationId)
  );

  const analysis: Analysis = {
    answer: rawAnalysis.answer,
    claims: validClaims,
    confidence,
    leadExplanation: rawAnalysis.leadExplanation,
    keyTakeaways: rawAnalysis.keyTakeaways,
    redFlags: rawAnalysis.redFlags,
    trendDrivers: filterFreshTrendDrivers(rawAnalysis.trendDrivers, sources),
    headline: rawAnalysis.headline,
    ...(validProductGroups.length > 0
      ? { productGroups: validProductGroups }
      : {}),
    ...(rawAnalysis.pharmacistNote
      ? { pharmacistNote: rawAnalysis.pharmacistNote }
      : {}),
    ...(validVerdicts.length > 0
      ? { efficacyVerdicts: validVerdicts }
      : {}),
  };

  return { kind: "analysis", analysis };
}

/**
 * Keep only groups whose productIds are present in the input
 * ProductMatch list, and drop duplicate productIds across groups
 * (first occurrence wins). Empty groups are discarded.
 */
function validateProductGroups(
  raw: z.infer<typeof SynthesisSchema>["productGroups"],
  input: ProductMatch[] | undefined
): Analysis["productGroups"] extends (infer T)[] | undefined ? T[] : never {
  if (!raw || raw.length === 0) return [];
  const validIds = new Set((input ?? []).map((m) => m.medicationId));
  if (validIds.size === 0) return [];

  const seen = new Set<number>();
  const out: { role: string; description: string; productIds: number[] }[] = [];
  for (const g of raw) {
    const filteredIds: number[] = [];
    for (const id of g.productIds) {
      if (!validIds.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      filteredIds.push(id);
      if (filteredIds.length >= 2) break;
    }
    if (filteredIds.length === 0) continue;
    out.push({
      role: g.role,
      description: g.description,
      productIds: filteredIds,
    });
  }
  // Cap total productIds at 5 as final safeguard
  let total = 0;
  const capped: typeof out = [];
  for (const g of out) {
    if (total >= 5) break;
    const room = 5 - total;
    const ids = g.productIds.slice(0, room);
    capped.push({ ...g, productIds: ids });
    total += ids.length;
  }
  return capped;
}

// ============================================================
// Post-processing — trendDrivers freshness guard
// ============================================================

/**
 * The LLM is instructed to pull trendDrivers only from sources
 * published within the last 30 days, but we can't rely on that alone.
 * If NO source in the provided list was published within the last
 * 30 days (relative to its retrievedAt), we clear trendDrivers so a
 * hallucinated "trend driver" doesn't leak into the Hook UI.
 *
 * We intentionally don't try to match individual drivers back to
 * individual sources — the guard is all-or-nothing:
 *   "there must be at least one fresh source for trendDrivers to
 *    be rendered at all."
 */
function filterFreshTrendDrivers(
  drivers: string[] | undefined,
  sources: SourceFragment[]
): string[] {
  if (!drivers || drivers.length === 0) return [];
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const hasFreshSource = sources.some((s) => {
    if (!s.publishedAt) return false;
    const parsed = Date.parse(s.publishedAt);
    if (Number.isNaN(parsed)) return false;
    return now - parsed <= THIRTY_DAYS_MS;
  });
  if (!hasFreshSource) {
    console.warn(
      "[synthesize-analysis] dropping trendDrivers — no sources within 30 days to back them"
    );
    return [];
  }
  return drivers;
}

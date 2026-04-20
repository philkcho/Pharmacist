/**
 * AI 1차 검토 — Personal Consult draft generator.
 *
 * Pipeline (per consult row):
 *   1. Emergency keyword detection — halt with "call 911" if found
 *   2. Entity extraction — drugs, ingredients, conditions, symptoms
 *   3. Category inference — drug_interactions / skin_care / supplements / ...
 *   4. References — Tier 1 FDA + Tier 2 PubMed via fetchArticleReferences
 *   5. Structured analysis draft — Zod-validated (interactions, routine, do/don't)
 *   6. Product recommendations — matchProducts() over approved DB
 *   7. Persist back to consults row, status -> 'ready_for_review'
 *
 * The pharmacist (Younghun) opens admin/consult-queue and edits the AI
 * draft before final approval. AI is the *researcher*, pharmacist is the
 * *signer*.
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

import {
  fetchArticleReferences,
  extractLikelyIngredient,
  type ArticleReference,
} from "@/lib/references/fetch-references";
import { matchProducts } from "@/lib/ai/match-products";
import { emptyEntities } from "@/lib/ai/types";

import type { ConsultRawInput, ConsultCategory } from "@/lib/actions/consults";

// ── Output schema (what AI must produce) ─────────────────────

const RecommendedProductSchema = z.object({
  name: z.string(),
  reason: z.string().describe("1-2 sentence pharmacist-style rationale."),
  ingredientFocus: z.string().optional(),
});

const InteractionWarningSchema = z.object({
  severity: z.enum(["low", "moderate", "high"]),
  items: z.array(z.string()).min(2).describe(
    "Names of items in the user's stack that interact. Use the actual drug names the user mentioned, never invent items they didn't list."
  ),
  description: z
    .string()
    .describe("Plain-English explanation of what happens and why."),
  mitigation: z
    .string()
    .describe("What the user should do — timing change, alternative, or talk to doctor."),
});

const RoutineStepSchema = z.object({
  time: z.enum(["morning", "midday", "evening", "bedtime", "as_needed"]),
  action: z.string(),
  rationale: z.string().optional(),
});

export const ConsultDraftSchema = z.object({
  oneLineSummary: z
    .string()
    .describe(
      "A single sentence pharmacist would say if asked what's most important here."
    ),

  isHighRisk: z
    .boolean()
    .describe(
      "True if any high-severity interaction, dangerous symptom, or prescription-level concern was detected. Flags to fast-track to pharmacist."
    ),

  isEmergency: z
    .boolean()
    .describe(
      "True only for actual emergencies (chest pain, anaphylaxis, suicidal ideation, severe bleeding, stroke symptoms). Will halt the consult and show 911 guidance."
    ),

  category: z.enum([
    "drug_interactions",
    "skin_care",
    "supplements",
    "symptoms",
    "pregnancy",
    "pediatric",
    "mental_health",
    "general",
  ]),

  stackReview: z
    .array(
      z.object({
        item: z.string(),
        verdict: z.string().describe("1-2 sentence pharmacist take on this item for this user."),
      })
    )
    .max(10)
    .describe("Per-item commentary on what the user is currently taking."),

  interactions: z
    .array(InteractionWarningSchema)
    .max(8)
    .describe("Drug-drug, drug-supplement, ingredient-ingredient interactions found."),

  routine: z
    .array(RoutineStepSchema)
    .max(12)
    .describe("Recommended optimal routine: when to take/apply each item."),

  doRecommendations: z
    .array(z.string())
    .max(6)
    .describe('Plain-English "do this" actions for the user.'),

  dontRecommendations: z
    .array(z.string())
    .max(6)
    .describe('Plain-English "avoid this" cautions for the user.'),

  productRecommendations: z
    .array(RecommendedProductSchema)
    .max(5)
    .describe(
      "Suggested additions or alternatives. Only suggest products with strong evidence and a clear fit for THIS user."
    ),

  followUpQuestions: z
    .array(z.string())
    .max(4)
    .describe(
      "Questions the pharmacist might want to ask before finalizing — used to prompt 'Request more info' action."
    ),

  disclaimer: z
    .string()
    .default(
      "Educational guidance based on FDA labels and clinical literature. Not a substitute for medical advice from a prescribing doctor."
    ),
});

export type ConsultDraft = z.infer<typeof ConsultDraftSchema>;

// ── Emergency detection ──────────────────────────────────────

const EMERGENCY_PATTERNS: readonly RegExp[] = [
  /\bchest\s+pain\b/i,
  /\bcan'?t\s+breathe\b/i,
  /\bdifficulty\s+breathing\b/i,
  /\banaphyla/i,
  /\bsuicid/i,
  /\bself[-\s]?harm/i,
  /\boverdose\b/i,
  /\bsevere\s+bleeding\b/i,
  /\bstroke\s+symptoms?\b/i,
  /\bfacial\s+drooping\b/i,
  /\bslurred\s+speech\b/i,
  /\bunconscious\b/i,
  /\bseizure\b/i,
];

function detectEmergencyText(text: string): boolean {
  return EMERGENCY_PATTERNS.some((re) => re.test(text));
}

// ── Entity extraction (lightweight) ──────────────────────────

interface ExtractedEntities {
  drugs: string[];
  ingredients: string[];
  symptoms: string[];
  conditions: string[];
  allergens: string[];
}

const ExtractedEntitiesSchema = z.object({
  drugs: z.array(z.string()).max(20),
  ingredients: z.array(z.string()).max(20),
  symptoms: z.array(z.string()).max(15),
  conditions: z.array(z.string()).max(10),
  allergens: z.array(z.string()).max(10),
});

const ENTITY_EXTRACTION_PROMPT = `You normalize a user's consult input into structured entities for downstream pharmacology lookup.

Critical disambiguation rules:
- The user may write in any language (Korean, English, Spanish, etc). Translate disease and drug names to standard English / generic INN names. Examples:
    "b형 간염약" / "B형 간염" → drug class "hepatitis B antiviral" (e.g. tenofovir, entecavir, adefovir). condition: "hepatitis B".  Do NOT add "vitamin B".
    "당뇨약" → drug class "diabetes medication" (e.g. metformin). condition: "diabetes".
    "혈압약" → drug class "antihypertensive". condition: "hypertension".
    "갑상선약" / "갑상샘약" → "levothyroxine". condition: "hypothyroidism".
    "비타민 D" → ingredient: "vitamin d".
- Do NOT confuse "B형 간염" (hepatitis B) with "vitamin B" — they are unrelated.
- Do NOT confuse "C형 간염" (hepatitis C) with "vitamin C".
- If the user names a generic class like "당뇨약" without a specific drug, list common matching generics (e.g. metformin, glipizide) under \`drugs\` so reference search has something to bite. Mark them as guesses by putting the most common one first.
- Lowercase. Singular nouns. No duplicates.
- If something is genuinely unknown (e.g. an obscure brand name), return it verbatim under \`drugs\` rather than fabricating a generic.`;

async function extractEntities(
  freeText: string,
  stackSnapshot: unknown,
  profileSnapshot: unknown
): Promise<ExtractedEntities> {
  const stackText = stackSnapshotToText(stackSnapshot);
  const profileText = profileSnapshotToText(profileSnapshot);

  const prompt = [
    "Extract entities from this consult input.",
    "",
    "User input:",
    freeText || "(no free text provided)",
    "",
    "Stack snapshot:",
    stackText || "(none)",
    "",
    "Profile snapshot:",
    profileText || "(none)",
  ].join("\n");

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      maxRetries: 1,
      schema: ExtractedEntitiesSchema,
      system: ENTITY_EXTRACTION_PROMPT,
      prompt,
    });
    return object;
  } catch {
    // Fallback — minimal entity set from free text alone
    const ingredient = extractLikelyIngredient(freeText);
    return {
      drugs: [],
      ingredients: ingredient ? [ingredient] : [],
      symptoms: [],
      conditions: [],
      allergens: [],
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────

function stackSnapshotToText(snapshot: unknown): string {
  if (!Array.isArray(snapshot)) return "";
  return snapshot
    .map((item) => {
      if (typeof item !== "object" || !item) return "";
      const r = item as Record<string, unknown>;
      const med = r.medications as { name?: string; generic_name?: string } | null;
      const name = med?.name ?? r.unmatched_name ?? "(unknown)";
      const dosage = r.dosage ? ` ${r.dosage}` : "";
      const freq = r.frequency ? ` ${r.frequency}` : "";
      const notes = r.timing_notes ? ` (${r.timing_notes})` : "";
      return `- ${name}${dosage}${freq}${notes} [${r.item_type}]`;
    })
    .filter(Boolean)
    .join("\n");
}

function profileSnapshotToText(snapshot: unknown): string {
  if (typeof snapshot !== "object" || !snapshot) return "";
  const p = snapshot as Record<string, unknown>;
  const lines: string[] = [];
  if (p.skin_type && p.skin_type !== "unknown") lines.push(`Skin type: ${p.skin_type}`);
  if (p.age_range) lines.push(`Age range: ${p.age_range}`);
  if (p.pregnancy_status && p.pregnancy_status !== "not_applicable") {
    lines.push(`Pregnancy status: ${p.pregnancy_status}`);
  }
  if (Array.isArray(p.conditions) && p.conditions.length) {
    lines.push(`Conditions: ${(p.conditions as string[]).join(", ")}`);
  }
  if (Array.isArray(p.allergies) && p.allergies.length) {
    lines.push(`Allergies: ${(p.allergies as string[]).join(", ")}`);
  }
  if (Array.isArray(p.primary_concerns) && p.primary_concerns.length) {
    lines.push(`Primary concerns: ${(p.primary_concerns as string[]).join(", ")}`);
  }
  return lines.join("\n");
}

function rawInputToText(input: ConsultRawInput): string {
  const parts: string[] = [];
  if (input.text) parts.push(input.text);
  if (input.symptoms?.length) parts.push(`Symptoms: ${input.symptoms.join(", ")}`);
  if (input.goal) parts.push(`Goal: ${input.goal}`);
  return parts.join("\n");
}

// ── Main draft generator ─────────────────────────────────────

const SYSTEM_PROMPT = `You are a licensed US pharmacist (PharmD) preparing a draft consult for review by another pharmacist.

Audience: an American consumer who shared their current medications, supplements, cosmetics, and health context in the user prompt below this system prompt.

ABSOLUTE rule — answer ONLY about what the USER actually wrote.
- Read the user's input section carefully.
- Identify exactly the medications and supplements the user listed.
- Every part of your answer (oneLineSummary, stackReview, interactions, routine, do/don't) must concern THOSE items only.
- Do NOT introduce drugs the user did not mention (e.g. levothyroxine, iron, warfarin) unless they appear in the user's input.
- If you find yourself drafting an interaction or stackReview item using a drug name the user never wrote, delete it.
- Translate non-English drug terms into the correct English generic before reasoning. Examples of disambiguation:
    - "B형 간염약" / Korean "b-hyung gan-yeom yak" → hepatitis B antiviral (tenofovir, entecavir, etc). NOT vitamin B.
    - "C형 간염약" → hepatitis C antiviral. NOT vitamin C.
    - "당뇨약" → diabetes medication (metformin family).
    - "갑상선약" → levothyroxine (only if the user actually mentions thyroid).
- Never confuse "B형 간염" / "B형" with vitamin B family. Hepatitis is a virus, vitamin B is a nutrient.

Voice rules:
- Plain English, 8th-grade reading level.
- Direct and pharmacist-precise, not breezy or padded.
- Cite mechanisms when they matter, but skip them when they don't.
- Honest about uncertainty. If evidence is weak or the user's input is ambiguous, say so.
- Never recommend stopping or changing a prescription medication — only suggest "talk to your prescribing doctor about this."
- For OTC meds, supplements, and cosmetics: you may suggest specific brand alternatives by name when the evidence supports it.

Critical safety rules:
- If the user reports an emergency (chest pain, anaphylaxis, suicidal ideation, severe bleeding, stroke symptoms), set isEmergency=true and recommend calling 911 / Poison Control 1-800-222-1222. Do not generate routine advice in that case.
- Flag any high-severity interaction as severity:'high' and isHighRisk=true.
- For pregnancy/breastfeeding users, default to the most conservative recommendation and flag any unclear category.

Format:
- stackReview: 1-2 sentences per item. Talk about THIS user's combination, not generic facts about the drug.
- interactions: only include actual interactions between drugs the user actually takes. Don't pad with theoretical concerns. Don't include interactions that involve drugs the user didn't mention.
- routine: concrete time-of-day actions for the user's actual medications.
- productRecommendations: only when there's a clear gap or a clearly better alternative. Empty array is fine.
- followUpQuestions: things you'd ask before signing off. The reviewing pharmacist may use these to "Request more info" from the user.

Coverage requirement:
- oneLineSummary, stackReview, and routine MUST cover EVERY medication the user mentioned, in order of clinical importance (prescription antivirals / chronic-disease drugs first, then supplements).
- If the user listed multiple prescription drugs, name each one in the summary.
- If you bring up an adjacent supplement the user did NOT take (e.g. mentioning long-term nutrient monitoring), state it AFTER the user's actual stack and start with the reason ("Because [their drug] can lower X over time, ask your doctor about ...").

Final self-check before responding:
- For every drug name in your output, ask: did the user mention this drug, OR is this a clearly-flagged adjacent recommendation? If neither, remove it.
- Did you cover every medication the user listed in oneLineSummary? If not, rewrite.`;

export interface DraftConsultInput {
  rawInput: ConsultRawInput;
  stackSnapshot?: unknown;
  profileSnapshot?: unknown;
}

export interface DraftConsultResult {
  draft: ConsultDraft;
  references: ArticleReference[];
  recommendations: { medicationId: number; name: string; slug: string; reason: string }[];
  isEmergency: boolean;
  isHighRisk: boolean;
  category: ConsultCategory;
  model: string;
}

export async function draftConsult(
  input: DraftConsultInput
): Promise<DraftConsultResult> {
  const freeText = rawInputToText(input.rawInput);
  const combinedText = [
    freeText,
    stackSnapshotToText(input.stackSnapshot),
  ].join("\n");

  // Step 1 — emergency fast-path. Skip the LLM entirely if we already
  // know it's an emergency. Cheaper + reliable.
  if (detectEmergencyText(combinedText)) {
    return {
      draft: emergencyDraft(),
      references: [],
      recommendations: [],
      isEmergency: true,
      isHighRisk: true,
      category: "symptoms",
      model: "rule-based",
    };
  }

  // Step 2 — extract entities for downstream retrieval + matching.
  const entities = await extractEntities(
    freeText,
    input.stackSnapshot,
    input.profileSnapshot
  );

  // Step 3 — references (Tier 1 FDA + Tier 2 PubMed). Best-effort.
  const allTerms = [...entities.drugs, ...entities.ingredients];
  const primaryTerm = allTerms[0] ?? extractLikelyIngredient(freeText) ?? "";
  let references: ArticleReference[] = [];
  if (primaryTerm) {
    try {
      references = await fetchArticleReferences({
        primaryTerm,
        fallbackTerms: allTerms.slice(1, 4),
        drugTerms: entities.drugs,
        limit: 6,
      });
    } catch (err) {
      console.warn("[draft-consult] references failed:", err);
    }
  }

  // Step 4 — analysis draft via Gemini (multimodal if photos attached)
  const draftPrompt = buildDraftPrompt({
    rawText: freeText,
    stackText: stackSnapshotToText(input.stackSnapshot),
    profileText: profileSnapshotToText(input.profileSnapshot),
    references,
    photoCount: input.rawInput.photos?.length ?? 0,
  });

  const photoUrls = (input.rawInput.photos ?? [])
    .map((p) => p.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0)
    .slice(0, 4);

  const { object: draft } =
    photoUrls.length > 0
      ? await generateObject({
          model: google("gemini-2.5-pro"),
          maxRetries: 1,
          schema: ConsultDraftSchema,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: draftPrompt },
                ...photoUrls.map((url) => ({
                  type: "image" as const,
                  image: new URL(url),
                })),
              ],
            },
          ],
        })
      : await generateObject({
          model: google("gemini-2.5-pro"),
          maxRetries: 1,
          schema: ConsultDraftSchema,
          system: SYSTEM_PROMPT,
          prompt: draftPrompt,
        });

  // Step 5 — re-fetch references using AI-identified drug names AND the
  // condition each drug is being used for. Without the condition,
  // "tenofovir" returns mostly HIV/PrEP papers; with "tenofovir hepatitis B"
  // we get the actual indication the user is asking about.
  const drugConditionPairs = extractDrugConditionPairs(draft, entities);
  if (drugConditionPairs.length > 0) {
    try {
      const refinedRefs = await fetchArticleReferences({
        primaryTerm: drugConditionPairs[0],
        fallbackTerms: drugConditionPairs.slice(1, 5),
        drugTerms: extractDrugTermsFromDraft(draft),
        limit: 6,
      });
      if (refinedRefs.length > 0) references = refinedRefs;
    } catch (err) {
      console.warn("[draft-consult] refined references failed:", err);
    }
  }

  // Step 6 — recommended product matching from approved DB
  const recommendations = await matchProductsForConsult(entities, draft);

  return {
    draft,
    references,
    recommendations,
    isEmergency: draft.isEmergency,
    isHighRisk: draft.isHighRisk || draft.isEmergency,
    category: draft.category,
    model: "gemini-2.5-pro",
  };
}

// Pull normalized English drug names out of the AI draft's stackReview
// and routine actions. These are far more reliable than guessing from
// raw user input, especially for non-English input.
function extractDrugTermsFromDraft(draft: ConsultDraft): string[] {
  const terms = new Set<string>();
  for (const item of draft.stackReview) {
    const cleaned = item.item.trim().toLowerCase();
    if (cleaned) terms.add(cleaned.split(/[\s,(]/, 1)[0]);
  }
  for (const step of draft.routine) {
    // crude: pull the first capitalized token-like word from the action
    const match = step.action.match(/\b([A-Z][a-zA-Z]{3,})\b/);
    if (match) terms.add(match[1].toLowerCase());
  }
  for (const interaction of draft.interactions) {
    for (const item of interaction.items) {
      const cleaned = item.trim().toLowerCase();
      if (cleaned) terms.add(cleaned.split(/[\s,(]/, 1)[0]);
    }
  }
  return Array.from(terms).slice(0, 6);
}

// Build "drug + condition" search queries so PubMed finds papers about
// the user's actual indication. Tenofovir alone → mostly HIV results;
// "tenofovir hepatitis B" → the relevant HBV literature.
//
// Strategy: pair each drug from the draft with each condition. If the
// extraction step picked up no conditions, fall back to drug-only.
function extractDrugConditionPairs(
  draft: ConsultDraft,
  entities: ExtractedEntities
): string[] {
  const drugs = extractDrugTermsFromDraft(draft);
  const conditions = entities.conditions
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  if (drugs.length === 0) return [];
  if (conditions.length === 0) return drugs;

  const pairs: string[] = [];
  for (const drug of drugs) {
    for (const condition of conditions) {
      if (drug && condition && !drug.includes(condition)) {
        pairs.push(`${drug} ${condition}`);
      }
    }
  }
  // Pairs first (most specific), then fall back to drug-only.
  return [...pairs, ...drugs];
}

function emergencyDraft(): ConsultDraft {
  return {
    oneLineSummary:
      "Your message includes symptoms that may need urgent care — please act on emergency guidance first.",
    isHighRisk: true,
    isEmergency: true,
    category: "symptoms",
    stackReview: [],
    interactions: [],
    routine: [],
    doRecommendations: [
      "Call 911 immediately if symptoms are severe or worsening.",
      "Call Poison Control at 1-800-222-1222 for poisoning or overdose concerns.",
      "Go to the nearest emergency room if you cannot reach emergency services.",
    ],
    dontRecommendations: [
      "Don't drive yourself if you feel faint, confused, or short of breath — call for help.",
      "Don't wait for online guidance to act on emergency symptoms.",
    ],
    productRecommendations: [],
    followUpQuestions: [],
    disclaimer:
      "If this is a medical emergency, call 911 or your local emergency number now. Online guidance is not a substitute for emergency care.",
  };
}

function buildDraftPrompt(args: {
  rawText: string;
  stackText: string;
  profileText: string;
  references: ArticleReference[];
  photoCount: number;
}): string {
  const lines: string[] = ["Generate a structured consult draft for this user."];

  lines.push("\n--- USER INPUT ---");
  lines.push(args.rawText || "(no free-text provided)");

  if (args.photoCount > 0) {
    lines.push(
      `\n--- ATTACHED PHOTOS (${args.photoCount}) ---`,
      "The user attached photo(s) below this prompt. Read any visible labels (Rx, OTC, supplements, cosmetics) and treat them as additional input. If a photo shows a skin condition or symptom, describe what you observe and factor it into the analysis."
    );
  }

  if (args.stackText) {
    lines.push("\n--- USER'S CURRENT STACK ---");
    lines.push(args.stackText);
  }

  if (args.profileText) {
    lines.push("\n--- USER PROFILE ---");
    lines.push(args.profileText);
  }

  if (args.references.length) {
    lines.push("\n--- AVAILABLE REFERENCES (you may cite these) ---");
    for (const r of args.references.slice(0, 8)) {
      lines.push(`- [${r.kind}] ${r.title}${r.year ? ` (${r.year})` : ""}`);
    }
  }

  lines.push(
    "\nProduce the structured draft. Be concise, evidence-based, and US-pharmacist-style."
  );
  return lines.join("\n");
}

// Wraps matchProducts() to take consult-extracted entities. Returns
// pharmacist-approved medications only (RLS + filter).
async function matchProductsForConsult(
  entities: ExtractedEntities,
  draft: ConsultDraft
): Promise<{ medicationId: number; name: string; slug: string; reason: string }[]> {
  // Combine entities with any product names mentioned in the draft's
  // recommendations so we can resolve to DB rows for affiliate links.
  const seedDrugs = Array.from(
    new Set([
      ...entities.drugs,
      ...entities.ingredients,
      ...draft.productRecommendations.map((r) => r.name),
    ])
  );

  if (seedDrugs.length === 0) return [];

  try {
    const matches = await matchProducts(
      {
        originalQuery: seedDrugs.join(", "),
        normalizedQuery: seedDrugs.join(" "),
        topicType: "interaction",
        intent: "Personal Consult — find approved alternatives or additions for the user's stack.",
        entities: {
          ...emptyEntities(),
          drugs: seedDrugs,
          genericIngredients: entities.ingredients,
        },
      },
      "health",
      5
    );

    return matches.map((m) => ({
      medicationId: m.medicationId,
      name: m.name,
      slug: m.slug,
      reason: m.reason,
    }));
  } catch (err) {
    console.warn("[draft-consult] matchProducts failed:", err);
    return [];
  }
}

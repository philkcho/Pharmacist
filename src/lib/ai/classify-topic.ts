import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { normalizeQuery } from "@/lib/trends/normalize";
import type { TopicUnderstanding } from "./types";

/**
 * Layer 1 — Question / topic understanding.
 *
 * Takes a raw query (either a trend phrase from the ingestion
 * pipeline or, in Phase 2, a user-typed question) and produces a
 * structured `TopicUnderstanding`:
 *
 *   - topicType:  what *kind* of question this is
 *   - entities:   drugs / ingredients / symptoms / populations /
 *                 conditions / substances / category slugs
 *   - intent:     one-line plain-English summary of what the
 *                 user is trying to figure out
 *
 * The classifier is deliberately simple: one Gemini Flash call with
 * a Zod-validated schema and `maxRetries: 0` so we never spend
 * extra free-tier quota on retries. Failed classifications return
 * a conservative `general_education` fallback with the raw query
 * preserved so downstream retrieval still has *something* to work
 * with.
 */

const TOPIC_TYPES = [
  "product_info",
  "safety_check",
  "dosage",
  "interaction",
  "symptom_relief",
  "comparison",
  "population_specific",
  "general_education",
  "out_of_scope",
] as const;

const EntitiesSchema = z.object({
  drugs: z
    .array(z.string())
    .describe(
      "Brand / product names visible in the query (e.g. 'Tylenol', 'Zyrtec', 'Farmacy Honey Halo'). Empty array if none."
    ),
  genericIngredients: z
    .array(z.string())
    .describe(
      "Generic or active ingredient names (e.g. 'acetaminophen', 'niacinamide', 'ceramide'). Empty array if none."
    ),
  symptoms: z
    .array(z.string())
    .describe(
      "Symptoms mentioned ('headache', 'congestion', 'dry skin'). Empty array if none."
    ),
  populations: z
    .array(z.string())
    .describe(
      "Population qualifiers ('pregnant', 'children under 6', 'elderly'). Empty array if none."
    ),
  conditions: z
    .array(z.string())
    .describe(
      "Health conditions ('liver disease', 'hypertension', 'eczema'). Empty array if none."
    ),
  substances: z
    .array(z.string())
    .describe(
      "Substances the drug might interact with ('alcohol', 'caffeine', 'MAOI'). Empty array if none."
    ),
  categorySlugs: z
    .array(z.string())
    .describe(
      "Best-guess category slugs from this fixed list: 'pain-relief', 'cold-flu', 'allergy', 'digestive-health', 'vitamins-supplements', 'skin-care-beauty', 'skin-care', 'sleep-relaxation', 'first-aid', 'oral-care', 'eye-care', 'baby-care'. Empty array if none match."
    ),
});

const ClassifyTopicSchema = z.object({
  topicType: z
    .enum(TOPIC_TYPES)
    .describe(
      "The kind of question. 'product_info' for plain product lookups, 'safety_check' for interaction/safety questions, 'symptom_relief' when the user asks 'what helps X', 'out_of_scope' for anything not related to OTC medications / supplements / cosmetics / common health topics."
    ),
  entities: EntitiesSchema,
  intent: z
    .string()
    .describe(
      "One plain-English sentence describing what the user is trying to figure out. No jargon."
    ),
});

const SYSTEM_PROMPT = `You are a clinical pharmacist parsing a search query about over-the-counter (OTC) medications, dietary supplements, or personal-care / skincare products.

Your job is to classify the query and extract the entities so a retrieval pipeline can fetch authoritative sources (FDA labels, PubMed, NIH, dermatology guidelines).

Rules:
- Be conservative. If you're not sure, return an empty array for that entity type — downstream retrieval handles missing entities gracefully, but hallucinated entities pollute the sources.
- For brand names, capture them verbatim as they appear in the query (including multi-word names like "Farmacy Honey Halo").
- For generic ingredients, normalize to the INN / USAN name when possible ("acetaminophen" not "APAP", "ibuprofen" not "brufen").
- topicType should reflect the PRIMARY intent. "What is Tylenol" is product_info, not general_education. "Is Tylenol safe with alcohol" is safety_check. "Tylenol vs Advil" is comparison.
- If the query is clearly non-health (weather, sports, entertainment), return topicType: "out_of_scope" with empty entities.
- categorySlugs must come from the fixed list in the schema. Don't invent new slugs.
- intent should be one sentence, plain English, no medical jargon.`;

/**
 * Run Layer 1 classification on a raw query.
 *
 * @param query  Raw trending phrase or user-typed question.
 * @param options.categoryHint  Optional category slug from the
 *   ingestion pipeline (e.g. trend_topics.category). The classifier
 *   will treat it as a bias but is free to override.
 */
export async function classifyTopic(
  query: string,
  options: { categoryHint?: string } = {}
): Promise<TopicUnderstanding> {
  const trimmed = query.trim();
  const normalized = normalizeQuery(trimmed);

  // Empty or trivially-short queries get a safe fallback without
  // spending an AI call.
  if (!normalized || normalized.length < 2) {
    return {
      originalQuery: trimmed,
      normalizedQuery: normalized,
      topicType: "out_of_scope",
      entities: {
        drugs: [],
        genericIngredients: [],
        symptoms: [],
        populations: [],
        conditions: [],
        substances: [],
        categorySlugs: [],
      },
      intent: "Query too short to classify.",
    };
  }

  const categoryHintLine = options.categoryHint
    ? `\n\nCategory hint from the upstream pipeline (use as a bias, not a requirement): "${options.categoryHint}"`
    : "";

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-pro"),
      maxRetries: 0,
      schema: ClassifyTopicSchema,
      system: SYSTEM_PROMPT,
      prompt: `Classify this query:\n\n"${trimmed}"${categoryHintLine}`,
    });

    return {
      originalQuery: trimmed,
      normalizedQuery: normalized,
      topicType: object.topicType,
      entities: object.entities,
      intent: object.intent,
    };
  } catch (err) {
    console.warn(
      "[classify-topic] Gemini call failed, falling back to general_education:",
      err instanceof Error ? err.message : err
    );
    return {
      originalQuery: trimmed,
      normalizedQuery: normalized,
      topicType: "general_education",
      entities: {
        drugs: [],
        genericIngredients: [],
        symptoms: [],
        populations: [],
        conditions: [],
        substances: [],
        categorySlugs: options.categoryHint ? [options.categoryHint] : [],
      },
      intent: `Unclassified query: ${trimmed}`,
    };
  }
}

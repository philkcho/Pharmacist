import { getBestOtcLabel, type FdaDrugLabel } from "@/lib/fda/client";
import type { SourceFragment } from "@/lib/ai/types";
import type { FetcherResult, RetrievalInput, SourceFetcher } from "./types";

/**
 * Fetches FDA drug-label data from openFDA for each drug entity.
 *
 * Unlike `fetch-db-facts` which relies on pharmacist-curated
 * references, this fetcher goes straight to the openFDA API and
 * breaks each matched label into **section-level fragments** so
 * Layer 3 can cite specific warnings / indications / dosing rather
 * than treating the whole label as one opaque source.
 *
 * Each section becomes its own SourceFragment:
 *   - Warnings         → relevance 90 (highest — safety critical)
 *   - Indications      → relevance 80
 *   - Dosing           → relevance 75
 *   - Adverse reactions→ relevance 70
 *
 * Only non-empty sections are emitted. The URL is DailyMed if the
 * label carries an SPL id, otherwise a generic openFDA reference.
 *
 * This module makes real network calls. Failures for individual
 * drugs are logged into `result.errors` and the fetcher keeps going
 * — a rate-limited openFDA shouldn't bring down the whole pipeline.
 */

const TIER: 1 = 1; // FDA drug labels are Tier 1

type Section = {
  title: string;
  body: string | null;
  relevance: number;
};

/**
 * Trim long label sections to something that fits in an LLM prompt
 * without losing the actionable first few sentences. openFDA label
 * warnings can be 3000+ characters; we keep the first ~500.
 */
function clip(text: string | null, maxChars: number): string {
  if (!text) return "";
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars).trimEnd() + "…";
}

function dailyMedUrl(splId: string): string {
  return `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${splId}`;
}

function buildCitation(label: FdaDrugLabel): string {
  const name = label.brandName ?? label.genericName ?? "OTC drug label";
  return `FDA DailyMed: ${name}`;
}

function labelToSections(label: FdaDrugLabel): Section[] {
  return [
    { title: "Warnings", body: label.warnings, relevance: 90 },
    { title: "When to stop using", body: label.stopUse, relevance: 88 },
    { title: "Do not use", body: label.doNotUse, relevance: 87 },
    { title: "Indications & usage", body: label.indications, relevance: 80 },
    {
      title: "Dosage & administration",
      body: label.dosageAndAdministration,
      relevance: 75,
    },
    { title: "Adverse reactions", body: label.sideEffects, relevance: 70 },
    { title: "Purpose", body: label.purpose, relevance: 60 },
  ];
}

function sectionsToFragments(
  label: FdaDrugLabel,
  drugName: string
): SourceFragment[] {
  const url = label.splId ? dailyMedUrl(label.splId) : "https://open.fda.gov/";
  const citation = buildCitation(label);
  const now = new Date().toISOString();

  return labelToSections(label)
    .filter((s) => s.body && s.body.trim().length > 0)
    .map((section): SourceFragment => ({
      id: 0, // renumbered by merge-and-rank
      tier: TIER,
      sourceType: "fda_label",
      title: `FDA ${section.title} — ${
        label.brandName ?? label.genericName ?? drugName
      }`,
      url,
      quote: clip(section.body, 500),
      citation,
      authors: label.manufacturer ?? undefined,
      publishedAt: undefined,
      retrievedAt: now,
      relevanceScore: section.relevance,
    }));
}

export const fetchFdaFacts: SourceFetcher = async (
  input: RetrievalInput
): Promise<FetcherResult> => {
  const result: FetcherResult = {
    fragments: [],
    errors: [],
    source: "fda",
  };

  const searchTerms = Array.from(
    new Set(
      [...input.entities.drugs, ...input.entities.genericIngredients]
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    )
  );

  if (searchTerms.length === 0) return result;

  // Cap the number of FDA lookups per retrieval call. openFDA is
  // free-tier rate-limited (240 req/min anon) and we don't want a
  // 20-drug entity list to burn the whole minute.
  const MAX_FDA_LOOKUPS = 5;
  const limited = searchTerms.slice(0, MAX_FDA_LOOKUPS);

  for (const term of limited) {
    try {
      const label = await getBestOtcLabel(term);
      if (!label) continue;
      result.fragments.push(...sectionsToFragments(label, term));
    } catch (err) {
      result.errors.push(
        `FDA label fetch for "${term}" failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
};

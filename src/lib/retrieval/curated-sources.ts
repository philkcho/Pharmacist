import type { SourceFragment, Entities } from "@/lib/ai/types";
import type { SourceType } from "@/lib/references/category-source-map";
import { SOURCE_TIER_LEVEL } from "@/lib/references/category-source-map";
import type { FetcherResult, RetrievalInput, SourceFetcher } from "./types";

/**
 * Pharmacist-curated directory of authoritative landing pages.
 *
 * This is NOT a crawler — it's a hand-picked list of evergreen
 * FDA / CDC / WHO / NIH / AAD / CIR / USP / AAP pages whose URLs
 * rarely change. When a query touches one of the `matchesAny`
 * entity strings OR one of the `categories`, the matching
 * entries land in Layer 2 with Tier 1 or Tier 2 status.
 *
 * Seed coverage (v1): the top ~30 evergreen authority URLs across
 * our two ingestion categories (Health, Beauty & Fitness). Expand
 * over time as the pharmacist team notices gaps.
 *
 * Matching is case-insensitive substring. "acetaminophen" in
 * `matchesAny` matches any entity containing that word, so brand
 * names (Tylenol) and generics (acetaminophen) both pull the
 * same entries without duplication.
 */

interface CuratedEntry {
  sourceType: SourceType;
  title: string;
  url: string;
  quote: string;
  /** Lowercased substrings of entities (drugs, ingredients, symptoms, populations). */
  matchesAny: string[];
  /** Category slugs (from `categories` table) this entry applies to. */
  categories: string[];
  /** 0–100. Defaults to 80 for Tier 1 hub pages, 75 for Tier 2. */
  relevanceScore?: number;
}

export const CURATED_SOURCES: readonly CuratedEntry[] = [
  // ── FDA core hub pages ────────────────────────────────────
  {
    sourceType: "fda_guidance",
    title: "FDA — Over-the-counter (OTC) Drugs",
    url: "https://www.fda.gov/drugs/types-applications/over-counter-otc-nonprescription-drugs",
    quote:
      "Overview of how the FDA regulates OTC nonprescription drugs in the United States.",
    matchesAny: [
      "otc",
      "nonprescription",
      "pain reliever",
      "medication",
      "drug",
    ],
    categories: ["pain-relief", "cold-flu", "allergy", "digestive-health"],
  },
  {
    sourceType: "fda_mocra",
    title: "FDA — Modernization of Cosmetics Regulation Act (MoCRA)",
    url: "https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022",
    quote:
      "FDA's expanded authority over cosmetic product safety, labeling, and adverse-event reporting under MoCRA 2022.",
    matchesAny: ["cosmetic", "skincare", "moisturizer", "cream", "serum"],
    categories: ["skin-care", "skin-care-beauty"],
  },
  {
    sourceType: "fda_label",
    title: "FDA — Acetaminophen information",
    url: "https://www.fda.gov/drugs/information-drug-class/acetaminophen-information",
    quote:
      "FDA consumer information on acetaminophen safety, liver risk, and maximum daily dose.",
    matchesAny: ["acetaminophen", "tylenol"],
    categories: ["pain-relief"],
  },
  {
    sourceType: "fda_label",
    title: "FDA — Ibuprofen prescribing information",
    url: "https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/nonsteroidal-anti-inflammatory-drugs-nsaids",
    quote:
      "FDA consumer safety information on NSAIDs including ibuprofen, naproxen, and aspirin.",
    matchesAny: ["ibuprofen", "advil", "motrin", "nsaid", "naproxen", "aleve"],
    categories: ["pain-relief"],
  },

  // ── CDC ───────────────────────────────────────────────────
  {
    sourceType: "cdc",
    title: "CDC — Common colds: Protect yourself and others",
    url: "https://www.cdc.gov/common-cold/about/index.html",
    quote:
      "CDC guidance on symptom management, prevention, and when to seek care for common cold and flu.",
    matchesAny: ["cold", "flu", "cough", "congestion", "runny nose"],
    categories: ["cold-flu"],
  },
  {
    sourceType: "cdc",
    title: "CDC — Allergies",
    url: "https://www.cdc.gov/nchs/fastats/allergies.asp",
    quote:
      "CDC data and prevention guidance on seasonal and perennial allergies.",
    matchesAny: ["allergy", "allergies", "antihistamine", "hay fever"],
    categories: ["allergy"],
  },

  // ── NIH Office of Dietary Supplements ─────────────────────
  {
    sourceType: "nih_ods",
    title: "NIH ODS — Vitamin C Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/",
    quote:
      "NIH Office of Dietary Supplements fact sheet on vitamin C: function, intakes, deficiency, and interactions.",
    matchesAny: ["vitamin c", "ascorbic acid"],
    categories: ["vitamins-supplements"],
  },
  {
    sourceType: "nih_ods",
    title: "NIH ODS — Vitamin D Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/",
    quote:
      "NIH ODS fact sheet on vitamin D: sources, deficiency risk, and supplementation guidelines.",
    matchesAny: ["vitamin d", "cholecalciferol", "ergocalciferol"],
    categories: ["vitamins-supplements"],
  },
  {
    sourceType: "nih_ods",
    title: "NIH ODS — Melatonin Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/Melatonin-HealthProfessional/",
    quote:
      "NIH ODS fact sheet on melatonin: efficacy, safety, dosing, and interactions.",
    matchesAny: ["melatonin", "sleep aid"],
    categories: ["sleep-relaxation", "vitamins-supplements"],
  },
  {
    sourceType: "nih_ods",
    title: "NIH ODS — Zinc Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/",
    quote:
      "NIH ODS fact sheet on zinc including immune support, upper intake levels, and interactions.",
    matchesAny: ["zinc"],
    categories: ["vitamins-supplements", "cold-flu"],
  },
  {
    sourceType: "nih_nccih",
    title: "NIH NCCIH — Dietary supplements: What you need to know",
    url: "https://www.nccih.nih.gov/health/dietary-supplements-what-you-need-to-know",
    quote:
      "NCCIH consumer guide on choosing and evaluating dietary supplements, including safety red flags.",
    matchesAny: ["supplement", "herbal", "probiotic"],
    categories: ["vitamins-supplements"],
  },

  // ── NIH MedlinePlus (consumer-facing) ─────────────────────
  {
    sourceType: "nih_medlineplus",
    title: "MedlinePlus — Headache",
    url: "https://medlineplus.gov/headache.html",
    quote:
      "MedlinePlus consumer overview of headache types, self-care, and when to see a doctor.",
    matchesAny: ["headache", "migraine"],
    categories: ["pain-relief"],
  },
  {
    sourceType: "nih_medlineplus",
    title: "MedlinePlus — Heartburn",
    url: "https://medlineplus.gov/heartburn.html",
    quote:
      "MedlinePlus overview of heartburn (GERD), OTC antacids, and red flags for serious causes.",
    matchesAny: ["heartburn", "acid reflux", "gerd", "antacid"],
    categories: ["digestive-health"],
  },

  // ── WHO ───────────────────────────────────────────────────
  {
    sourceType: "who",
    title: "WHO — Influenza (Seasonal) fact sheet",
    url: "https://www.who.int/news-room/fact-sheets/detail/influenza-(seasonal)",
    quote:
      "WHO guidance on seasonal flu transmission, symptoms, and OTC symptom management.",
    matchesAny: ["flu", "influenza"],
    categories: ["cold-flu"],
  },

  // ── AAD — dermatology authority ──────────────────────────
  {
    sourceType: "aad",
    title: "AAD — How to apply sunscreen",
    url: "https://www.aad.org/public/everyday-care/sun-protection/sunscreen-patients/how-to-apply-sunscreen",
    quote:
      "American Academy of Dermatology guidance on sunscreen selection (SPF 30+, broad-spectrum) and application.",
    matchesAny: ["sunscreen", "spf", "uv", "sun protection"],
    categories: ["skin-care", "skin-care-beauty"],
    relevanceScore: 85,
  },
  {
    sourceType: "aad",
    title: "AAD — Dry skin: Diagnosis and treatment",
    url: "https://www.aad.org/public/diseases/a-z/dry-skin-treatment",
    quote:
      "AAD patient guidance on managing dry skin with moisturizers, humectants, and occlusives.",
    matchesAny: ["dry skin", "moisturizer", "xerosis", "eczema"],
    categories: ["skin-care", "skin-care-beauty"],
    relevanceScore: 85,
  },
  {
    sourceType: "aad",
    title: "AAD — Acne: Diagnosis and treatment",
    url: "https://www.aad.org/public/diseases/acne/diy/acne-treatment",
    quote:
      "AAD guidance on OTC acne treatments (benzoyl peroxide, salicylic acid, adapalene) and when to see a dermatologist.",
    matchesAny: ["acne", "benzoyl peroxide", "salicylic acid", "adapalene"],
    categories: ["skin-care", "skin-care-beauty"],
    relevanceScore: 85,
  },
  {
    sourceType: "aad",
    title: "AAD — Retinoids for anti-aging",
    url: "https://www.aad.org/public/cosmetic/anti-aging",
    quote:
      "AAD overview of retinoids and anti-aging skincare ingredients backed by clinical evidence.",
    matchesAny: ["retinol", "retinoid", "anti aging", "anti-aging", "tretinoin"],
    categories: ["skin-care", "skin-care-beauty"],
    relevanceScore: 85,
  },

  // ── CIR — cosmetic ingredient safety ──────────────────────
  {
    sourceType: "cir",
    title: "Cosmetic Ingredient Review — Safety assessments database",
    url: "https://www.cir-safety.org/ingredients",
    quote:
      "Independent expert panel's safety assessments of individual cosmetic ingredients, used by FDA and industry.",
    matchesAny: ["cosmetic ingredient", "niacinamide", "hyaluronic acid", "ceramide"],
    categories: ["skin-care", "skin-care-beauty"],
    relevanceScore: 80,
  },

  // ── Skin Cancer Foundation ───────────────────────────────
  {
    sourceType: "skin_cancer_foundation",
    title: "Skin Cancer Foundation — Sunscreen FAQ",
    url: "https://www.skincancer.org/skin-cancer-prevention/sun-protection/sunscreen/",
    quote:
      "Skin Cancer Foundation's guidance on sunscreen selection, re-application intervals, and Seal of Recommendation.",
    matchesAny: ["sunscreen", "spf", "broad spectrum"],
    categories: ["skin-care", "skin-care-beauty"],
    relevanceScore: 80,
  },

  // ── USP ───────────────────────────────────────────────────
  {
    sourceType: "usp",
    title: "USP — Dietary Supplement Verified program",
    url: "https://www.quality-supplements.org/",
    quote:
      "U.S. Pharmacopeia's independent verification program for dietary supplement identity, purity, and potency.",
    matchesAny: ["supplement quality", "usp verified", "supplement"],
    categories: ["vitamins-supplements"],
    relevanceScore: 80,
  },

  // ── AAP — pediatrics ──────────────────────────────────────
  {
    sourceType: "aap",
    title: "AAP — Medication safety tips",
    url: "https://www.healthychildren.org/English/safety-prevention/at-home/medication-safety/Pages/default.aspx",
    quote:
      "American Academy of Pediatrics guidance on safe use of OTC medications in children, including dosing.",
    matchesAny: ["child", "children", "pediatric", "infant", "toddler"],
    categories: ["pain-relief", "cold-flu", "allergy"],
    relevanceScore: 80,
  },

  // ── ADA Seal ──────────────────────────────────────────────
  {
    sourceType: "ada_seal",
    title: "ADA Seal of Acceptance",
    url: "https://www.ada.org/resources/research/science-and-research-institute/ada-seal-of-acceptance",
    quote:
      "American Dental Association's independent evaluation program for OTC oral care products.",
    matchesAny: ["toothpaste", "mouthwash", "floss", "oral care", "fluoride"],
    categories: ["oral-care"],
    relevanceScore: 80,
  },

  // ── AASM — sleep medicine ─────────────────────────────────
  {
    sourceType: "aasm",
    title: "AASM — Sleep education for patients",
    url: "https://sleepeducation.org/",
    quote:
      "American Academy of Sleep Medicine's patient-facing resource on sleep hygiene and OTC sleep aids.",
    matchesAny: ["insomnia", "sleep", "melatonin", "diphenhydramine"],
    categories: ["sleep-relaxation"],
    relevanceScore: 80,
  },
];

/**
 * Match curated entries against the entities + category hint of
 * a retrieval input. Returns the matched entries converted to
 * SourceFragments.
 *
 * Matching is deliberately simple (substring containment) — the
 * curated list is small enough that this is fast and we prefer
 * over-matching to missing a good source. merge-and-rank will
 * dedup by URL after all fetchers return.
 */
function matchEntries(entities: Entities, categoryHint?: string): CuratedEntry[] {
  const haystack = [
    ...entities.drugs,
    ...entities.genericIngredients,
    ...entities.symptoms,
    ...entities.populations,
    ...entities.conditions,
    ...entities.substances,
  ]
    .map((s) => s.toLowerCase())
    .filter((s) => s.length > 0);

  const categorySet = new Set(
    [...entities.categorySlugs, categoryHint ?? ""]
      .filter((c) => c.length > 0)
      .map((c) => c.toLowerCase())
  );

  const matches = new Set<CuratedEntry>();
  for (const entry of CURATED_SOURCES) {
    // Category match
    if (
      categorySet.size > 0 &&
      entry.categories.some((c) => categorySet.has(c.toLowerCase()))
    ) {
      matches.add(entry);
      continue;
    }
    // Entity substring match
    const matchesEntity = entry.matchesAny.some((needle) =>
      haystack.some((hay) => hay.includes(needle.toLowerCase()))
    );
    if (matchesEntity) matches.add(entry);
  }

  return Array.from(matches);
}

function entryToFragment(entry: CuratedEntry): SourceFragment {
  const tier = (SOURCE_TIER_LEVEL[entry.sourceType] ?? 2) as 1 | 2 | 3;
  return {
    id: 0, // renumbered by merge-and-rank
    tier,
    sourceType: entry.sourceType,
    title: entry.title,
    url: entry.url,
    quote: entry.quote,
    citation: entry.title,
    retrievedAt: new Date().toISOString(),
    relevanceScore: entry.relevanceScore ?? (tier === 1 ? 80 : 75),
  };
}

export const fetchCuratedSources: SourceFetcher = async (
  input: RetrievalInput
): Promise<FetcherResult> => {
  const result: FetcherResult = {
    fragments: [],
    errors: [],
    source: "curated",
  };

  try {
    const entries = matchEntries(input.entities, input.categoryHint);
    for (const entry of entries) {
      result.fragments.push(entryToFragment(entry));
    }
  } catch (err) {
    result.errors.push(
      `curated-sources match failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return result;
};

import googleTrends from "google-trends-api";
import {
  CATEGORY_SEEDS,
  INGESTION_CATEGORIES,
  type TrendCategory,
} from "./category-mapping";

/**
 * One trending query returned from Google Trends, pre-classified
 * into top vs rising by the caller.
 */
export interface RawTrend {
  query: string;
  volumeScore: number | null;
  formattedValue: string | null;
  rankType: "top" | "rising";
  rankPosition: number; // 1-based within its (category, seed, rankType) bucket
  seed: string;
  raw: unknown;
}

export interface CategoryTrendBundle {
  category: TrendCategory;
  trends: RawTrend[];
}

/**
 * The shape of the JSON string `googleTrends.relatedQueries` resolves
 * with. Only the fields we read are declared; everything else comes
 * along in the `raw` payload.
 */
interface RelatedQueriesResponse {
  default?: {
    rankedList?: Array<{
      rankedKeyword?: Array<{
        query?: string;
        value?: number;
        formattedValue?: string;
        link?: string;
      }>;
    }>;
  };
}

interface FetchOptions {
  /** Ingestion categories to pull. Defaults to INGESTION_CATEGORIES. */
  categories?: ReadonlyArray<Exclude<TrendCategory, "other">>;
  /** Geo code passed to Google Trends. Defaults to 'US'. */
  geo?: string;
  /** How many top + how many rising entries to keep per seed. Defaults to 2. */
  limitPerBucket?: number;
  /** Past-week window end. Defaults to now. */
  endTime?: Date;
}

/**
 * Parse one `relatedQueries` JSON response into structured RawTrend
 * items. The upstream response shape:
 *   default.rankedList[0].rankedKeyword  → Top queries
 *   default.rankedList[1].rankedKeyword  → Rising queries
 *
 * Either list may be missing if Google returns no data for the seed
 * in the requested window. We defensively return an empty array in
 * that case.
 */
function parseRelatedQueries(
  jsonString: string,
  seed: string,
  limitPerBucket: number
): RawTrend[] {
  let parsed: RelatedQueriesResponse;
  try {
    parsed = JSON.parse(jsonString) as RelatedQueriesResponse;
  } catch (err) {
    console.warn(
      `[google-trends] failed to parse relatedQueries JSON for "${seed}":`,
      err
    );
    return [];
  }

  const rankedLists = parsed.default?.rankedList ?? [];
  const topList = rankedLists[0]?.rankedKeyword ?? [];
  const risingList = rankedLists[1]?.rankedKeyword ?? [];

  const out: RawTrend[] = [];
  topList.slice(0, limitPerBucket).forEach((item, index) => {
    if (!item.query) return;
    out.push({
      query: item.query,
      volumeScore: typeof item.value === "number" ? item.value : null,
      formattedValue: item.formattedValue ?? null,
      rankType: "top",
      rankPosition: index + 1,
      seed,
      raw: item,
    });
  });
  risingList.slice(0, limitPerBucket).forEach((item, index) => {
    if (!item.query) return;
    out.push({
      query: item.query,
      volumeScore: typeof item.value === "number" ? item.value : null,
      formattedValue: item.formattedValue ?? null,
      rankType: "rising",
      rankPosition: index + 1,
      seed,
      raw: item,
    });
  });
  return out;
}

/**
 * Pull trending queries for every seed in every enabled category.
 *
 * Each seed contributes up to `limitPerBucket` top + `limitPerBucket`
 * rising queries. With 3 seeds per category and limit=2, a single
 * run yields up to 12 trends per category before dedup.
 *
 * Failures on individual seeds are logged and swallowed so a single
 * flaky seed can't break the whole ingestion. If EVERY seed fails
 * we still return an empty bundle — the caller decides how to surface
 * that (currently: ingestWeeklyTrends logs an error into the result).
 */
export async function fetchWeeklyTrends(
  options: FetchOptions = {}
): Promise<CategoryTrendBundle[]> {
  const categories = options.categories ?? INGESTION_CATEGORIES;
  const geo = options.geo ?? "US";
  const limitPerBucket = options.limitPerBucket ?? 2;
  const endTime = options.endTime ?? new Date();
  const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);

  const bundles: CategoryTrendBundle[] = [];

  for (const category of categories) {
    const seeds = CATEGORY_SEEDS[category];
    const categoryTrends: RawTrend[] = [];

    for (const seed of seeds) {
      try {
        const jsonString = await googleTrends.relatedQueries({
          keyword: seed,
          startTime,
          endTime,
          geo,
        });
        const trends = parseRelatedQueries(jsonString, seed, limitPerBucket);
        categoryTrends.push(...trends);
      } catch (err) {
        console.warn(
          `[google-trends] relatedQueries failed for category "${category}" seed "${seed}":`,
          err instanceof Error ? err.message : err
        );
      }
    }

    bundles.push({ category, trends: categoryTrends });
  }

  return bundles;
}

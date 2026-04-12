/**
 * Minimal ambient types for the `google-trends-api` package.
 *
 * The package ships no TypeScript types. We only use a small subset
 * of its API (currently just `relatedQueries`) so instead of pulling
 * in `@types/...` or installing `any` everywhere, we declare just
 * the surface we touch.
 *
 * The package's own return type is `Promise<string>` — it resolves
 * with a JSON string that the caller must `JSON.parse`. We preserve
 * that shape here so callers stay honest.
 */

declare module "google-trends-api" {
  export interface RelatedQueriesOptions {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
    hl?: string;
    timezone?: number;
    category?: number;
    property?: "images" | "news" | "youtube" | "froogle";
  }

  export interface DailyTrendsOptions {
    geo: string;
    trendDate?: Date;
    hl?: string;
  }

  export function relatedQueries(
    options: RelatedQueriesOptions
  ): Promise<string>;

  export function dailyTrends(
    options: DailyTrendsOptions
  ): Promise<string>;

  const googleTrends: {
    relatedQueries: typeof relatedQueries;
    dailyTrends: typeof dailyTrends;
  };

  export default googleTrends;
}

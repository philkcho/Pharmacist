/**
 * Query normalization + ISO week helpers for the trend pipeline.
 *
 * Normalization rules (must stay consistent across ingestion, dedup,
 * and any future Phase 2 user-Q&A caching key):
 *   1. Lowercase
 *   2. Strip diacritics (NFD decompose + drop combining marks)
 *   3. Replace any non-alphanumeric-ish character with a space
 *   4. Collapse runs of whitespace
 *   5. Trim
 *
 * The resulting string is stored in `trend_topics.normalized_query`
 * and participates in the `UNIQUE (source, normalized_query,
 * detected_week)` constraint + the 4-week dedup window.
 */

export function normalizeQuery(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns the ISO date ('YYYY-MM-DD') for the Monday of the week that
 * contains the given date. All times are interpreted in UTC so that
 * a cron job running at 09:00 UTC on a Monday lands on the same
 * "detected_week" across deploys, regardless of server timezone.
 */
export function getMondayOfWeek(d: Date = new Date()): string {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const day = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date.toISOString().slice(0, 10);
}

/**
 * Is the given date a Monday in UTC? The weekly cron runs daily but
 * only triggers ingestion on Mondays, so this gate lives here.
 */
export function isMondayUtc(d: Date = new Date()): boolean {
  return d.getUTCDay() === 1;
}

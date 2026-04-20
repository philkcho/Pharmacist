/**
 * Slugify a pharmacist answer's oneLineSummary into a URL-friendly stub
 * suffixed with the first 8 chars of the consult id for uniqueness.
 */
export function slugifyConsult(
  summary: string | undefined,
  consultId: string
): string {
  const base = (summary ?? "question")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  const suffix = consultId.slice(0, 8);
  return `${base || "consult"}-${suffix}`;
}

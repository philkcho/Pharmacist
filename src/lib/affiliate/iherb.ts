/**
 * iHerb affiliate helpers.
 *
 * Reads IHERB_RCODE from env (not checked into git) and appends it as a
 * tracking parameter to every outbound iHerb URL so the Rewards program
 * attributes the referral to this site.
 *
 * Works with both search URLs (?kw=...) and direct product URLs
 * (/pr/.../123). If IHERB_RCODE is unset the URL is returned untouched —
 * links keep working, just no commission.
 */

const IHERB_RCODE = process.env.IHERB_RCODE ?? "";

export function withIherbAffiliate(url: string): string {
  if (!IHERB_RCODE) return url;
  if (!url.includes("iherb.com")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}rcode=${encodeURIComponent(IHERB_RCODE)}`;
}

/**
 * Build an iHerb search URL for a product name.
 *
 * Strips dose/quantity suffixes (e.g. "100mg", "60 softgels") that add
 * noise and wraps the remaining brand+name in double quotes so iHerb's
 * search treats it as an exact phrase — keeps the top results focused
 * on the actual product instead of competitor catalog dilution.
 */
export function iherbSearchUrl(productName: string): string {
  const cleaned = productName
    // Numeric + unit tokens (100mg, 500 mg, 60 ct, 90 softgels, 2 oz...)
    .replace(
      /\b\d+\s*(mg|mcg|iu|ml|oz|fl\s*oz|g|ct|count|softgels?|capsules?|caps?|tablets?|tabs?|gummies|servings?|lb|kg)\b/gi,
      ""
    )
    // Trailing bare numbers often reference pack size ("Qunol CoQ10 30")
    .replace(/\b\d+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Quote the phrase so iHerb treats it as exact-match. Empty fallback
  // shouldn't happen but keep it safe.
  const phrase = cleaned.length > 0 ? cleaned : productName;
  const quoted = `"${phrase}"`;
  return withIherbAffiliate(
    `https://www.iherb.com/search?kw=${encodeURIComponent(quoted)}`
  );
}

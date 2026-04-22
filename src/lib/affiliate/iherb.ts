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
  // Don't rewrite non-iherb URLs (defensive — caller already knows).
  if (!url.includes("iherb.com")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}rcode=${encodeURIComponent(IHERB_RCODE)}`;
}

export function iherbSearchUrl(query: string): string {
  return withIherbAffiliate(
    `https://www.iherb.com/search?kw=${encodeURIComponent(query)}`
  );
}

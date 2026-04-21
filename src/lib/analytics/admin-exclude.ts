// Admin self-visits geolocate to Westwood — exclude them from analytics so
// dashboard numbers reflect real visitors only.
//
// Country representation depends on the geo source:
//   - Vercel IP header returns ISO-2 code ("US")
//   - ip-api.com fallback returns full name ("United States")
// So filtering by country is unreliable. City is specific enough on its own.
//
// Effective rule: NOT (city = 'Westwood')
// PostgREST .or() form: city IS NULL OR city != 'Westwood'
// (NULL pass-through keeps GeoIP-unresolved rows counted.)
export const ADMIN_EXCLUDE_CITY = "Westwood";
export const EXCLUDE_ADMIN_CITY_FILTER = `city.is.null,city.neq.${ADMIN_EXCLUDE_CITY}`;

// Single source of truth for the site's pharmacist reviewer identity.
// Surfaced on article credits, /about, footer, and JSON-LD author/reviewer
// blocks — reinforces E-E-A-T for YMYL (health) content.
//
// UI exposes: real name + email (mailto link) for direct contact.
// JSON-LD still emits LinkedIn via `sameAs` so Google can cross-verify
// pharmacist credentials by crawling the linked public profile.
// No degree abbreviation, license, state, or photo is exposed.

export const SITE_AUTHOR = {
  name: "Younghun Cho",
  email: "philkucho@gmail.com",
  // Retained for JSON-LD sameAs only — not rendered in UI anymore.
  linkedinUrl: "https://www.linkedin.com/in/younghun-cho-71b36a241/",
} as const;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

// JSON-LD Person representation of the author — used as Article.author,
// Article.reviewedBy, Review.author, and on /about ProfilePage.
export function authorPersonSchema() {
  return {
    "@type": "Person",
    "@id": `${SITE_URL}/about#author`,
    name: SITE_AUTHOR.name,
    url: `${SITE_URL}/about`,
    sameAs: [SITE_AUTHOR.linkedinUrl],
  };
}

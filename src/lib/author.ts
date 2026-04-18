// Single source of truth for the site's pharmacist author/reviewer identity.
// Surfaced on Dr.'s Analysis cards, article credits, /about, and JSON-LD
// author/reviewer blocks — reinforces E-E-A-T for YMYL (health) content.
//
// To enable the real author photo, drop a file at:
//   public/authors/younghun-cho.jpg  (square, >=256x256 recommended)
// If the file is missing, the avatar renders initials as a fallback.
//
// TODO (before production trust review): confirm degree abbreviation
// (PharmD vs RPh vs BPharm) and real LinkedIn URL with the author.

export const SITE_AUTHOR = {
  name: "Younghun Cho",
  credential: "PharmD",
  jobTitle: "Pharmacist, PharmD",
  shortCredit: "Younghun Cho, PharmD",
  linkedinUrl: "https://www.linkedin.com/in/younghun-cho",
  photoPath: "/authors/younghun-cho.jpg",
  initials: "YC",
} as const;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://drpharmacist.com";

// JSON-LD Person representation of the author — used as Article.author,
// Article.reviewedBy, Review.author, and on /about ProfilePage.
export function authorPersonSchema() {
  return {
    "@type": "Person",
    "@id": `${SITE_URL}/about#author`,
    name: SITE_AUTHOR.name,
    jobTitle: SITE_AUTHOR.jobTitle,
    url: `${SITE_URL}/about`,
    sameAs: [SITE_AUTHOR.linkedinUrl],
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "degree",
      name: SITE_AUTHOR.credential,
    },
  };
}

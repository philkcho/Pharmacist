// Single source of truth for the site's pharmacist author/reviewer identity.
// Surfaced on Dr.'s Analysis cards, article credits, /about, and JSON-LD
// author/reviewer blocks — reinforces E-E-A-T for YMYL (health) content.
//
// To enable the real author photo, drop a file at:
//   public/authors/younghun-cho.jpg  (square, >=256x256 recommended)
// If the file is missing, the avatar renders initials as a fallback.

export const SITE_AUTHOR = {
  name: "Younghun Cho",
  credential: "PharmD",
  jobTitle: "Pharmacist, PharmD",
  shortCredit: "Younghun Cho, PharmD",
  linkedinUrl: "https://www.linkedin.com/in/younghun-cho",
  photoPath: "/authors/younghun-cho.jpg",
  initials: "YC",
} as const;

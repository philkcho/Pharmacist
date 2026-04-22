export const BRAND = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "AI PharmCare",
  legalName: "AI PharmCare",
  domain: "aipharmcare.com",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com",
  tagline:
    "Evidence-based health & beauty analysis, reviewed by licensed pharmacists",
  shortDescription:
    "Pharmacist-reviewed product analysis backed by FDA data, clinical research, and ingredient science.",
} as const;

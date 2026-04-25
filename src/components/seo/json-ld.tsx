/**
 * JSON-LD structured data components for SEO.
 * Renders <script type="application/ld+json"> in the page head.
 */

import { SITE_AUTHOR, authorPersonSchema } from "@/lib/author";
import { BRAND } from "@/lib/brand";

const SITE_URL = BRAND.url;

// ── Organization (site-wide) ────────────────────────────────

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: BRAND.legalName,
    url: SITE_URL,
    description: BRAND.shortDescription,
    logo: `${SITE_URL}/icon.png`,
    founder: authorPersonSchema(),
    sameAs: [SITE_AUTHOR.linkedinUrl],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ── WebSite (sitelinks search box hint) ─────────────────────

export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: BRAND.name,
    description: BRAND.shortDescription,
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ── MedicalWebPage (YMYL signal for health content) ─────────

export function MedicalWebPageJsonLd({
  name,
  description,
  url,
  lastReviewed,
  about,
  audience = "Patient",
}: {
  name: string;
  description: string;
  url: string;
  lastReviewed?: string | null;
  /** Free-text label of the medical entity discussed (e.g. drug or condition name). */
  about?: string;
  audience?: "Patient" | "Clinician";
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: name.slice(0, 110),
    description: description.slice(0, 200),
    url,
    inLanguage: "en-US",
    audience: { "@type": "MedicalAudience", audienceType: audience },
    specialty: "Pharmacy",
    reviewedBy: authorPersonSchema(),
    publisher: { "@id": `${SITE_URL}/#organization` },
  };

  if (lastReviewed) data.lastReviewed = lastReviewed;
  if (about) {
    data.about = { "@type": "MedicalEntity", name: about };
    data.mainContentOfPage = { "@type": "WebPageElement", about };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ── Article (trending / expert analysis) ────────────────────

export function ArticleJsonLd({
  title,
  description,
  url,
  datePublished,
  dateModified,
  imageUrl,
}: {
  title: string;
  description: string;
  url: string;
  datePublished?: string | null;
  dateModified?: string | null;
  imageUrl?: string | null;
}) {
  const person = authorPersonSchema();
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title.slice(0, 110),
    description: description.slice(0, 200),
    url,
    publisher: {
      "@type": "Organization",
      name: BRAND.legalName,
      url: SITE_URL,
    },
    author: person,
    reviewedBy: person,
  };

  if (datePublished) data.datePublished = datePublished;
  if (dateModified) {
    data.dateModified = dateModified;
    data.lastReviewed = dateModified;
  }
  if (imageUrl) data.image = imageUrl;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ── BreadcrumbList (navigation hierarchy) ───────────────────

export function BreadcrumbListJsonLd({
  items,
}: {
  items: Array<{ name: string; url: string }>;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ── Product Review (analysis page) ──────────────────────────

export function ProductReviewJsonLd({
  productName,
  description,
  url,
  imageUrl,
  score,
  pros,
  cons,
}: {
  productName: string;
  description: string;
  url: string;
  imageUrl?: string | null;
  score?: number | null;
  pros?: string[];
  cons?: string[];
}) {
  // Convert score (0-100) to rating (1-5)
  const rating = score ? Math.round((score / 100) * 4 + 1) : null;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName,
    description: description.slice(0, 200),
    url,
  };

  if (imageUrl) data.image = imageUrl;

  if (rating) {
    data.review = {
      "@type": "Review",
      author: authorPersonSchema(),
      publisher: {
        "@type": "Organization",
        name: BRAND.legalName,
        url: SITE_URL,
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: rating,
        bestRating: 5,
        worstRating: 1,
      },
      ...(pros && pros.length > 0
        ? { positiveNotes: { "@type": "ItemList", itemListElement: pros.slice(0, 5).map((p, i) => ({ "@type": "ListItem", position: i + 1, name: typeof p === "string" ? p : (p as { text: string }).text })) } }
        : {}),
      ...(cons && cons.length > 0
        ? { negativeNotes: { "@type": "ItemList", itemListElement: cons.slice(0, 5).map((c, i) => ({ "@type": "ListItem", position: i + 1, name: typeof c === "string" ? c : (c as { text: string }).text })) } }
        : {}),
    };

    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating,
      bestRating: 5,
      worstRating: 1,
      reviewCount: 1,
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

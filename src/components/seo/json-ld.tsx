/**
 * JSON-LD structured data components for SEO.
 * Renders <script type="application/ld+json"> in the page head.
 */

import { SITE_AUTHOR, authorPersonSchema } from "@/lib/author";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

// ── Organization (site-wide) ────────────────────────────────

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Dr.pharmacist",
    url: SITE_URL,
    description:
      "Pharmacist-reviewed health & beauty analysis backed by FDA data, clinical research, and ingredient science.",
  };

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
      name: "Dr.pharmacist",
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
        name: "Dr.pharmacist",
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

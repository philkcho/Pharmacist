import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Star,
  Check,
  X,
  FlaskConical,
  ShoppingCart,
  Scale,
  Pill,
  Target,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { ProductImage } from "@/components/ui/product-image";
import {
  getTrendBySlug,
  type TrendPageData,
} from "@/lib/actions/trends";
import type {
  Analysis,
  SourceFragment,
  MarketReaction,
  ProductMatch,
} from "@/lib/ai/types";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleJsonLd, BreadcrumbListJsonLd, MedicalWebPageJsonLd } from "@/components/seo/json-ld";
import { ReviewerByline } from "@/components/ui/reviewer-byline";
import { ArticleHero } from "@/components/expert/article-hero";
import { TrendCover } from "@/components/trending/trend-cover";
import { GlobalCtaBar } from "@/components/share/global-cta-bar";
import { SITE_AUTHOR } from "@/lib/author";

// ============================================================
// Metadata
// ============================================================
//
// Note: no generateStaticParams — page is dynamically rendered.
// getTrendBySlug uses cookies-backed Supabase client which can't
// run during static prerender, and other /[slug] pages (is-safe,
// ingredients, vs, expert, analysis) follow the same pattern.

interface TrendPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: TrendPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTrendBySlug(slug);
  if (!data) return { title: "Trend not found" };

  const synthesis = data.analysis.synthesisJsonb as Analysis | null;
  const description = synthesis?.answer
    ? synthesis.answer.replace(/\[\d+\]/g, "").slice(0, 155)
    : data.topic.queryText;

  const title = synthesis?.headline ?? `${data.topic.queryText} — Trending in ${data.topic.category === "health" ? "Health" : "Beauty"}`;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/trending/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      ...(data.topic.imageUrl ? { images: [{ url: data.topic.imageUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(data.topic.imageUrl ? { images: [data.topic.imageUrl] } : {}),
    },
  };
}

// ============================================================
// Page
// ============================================================

export default async function TrendPage({ params }: TrendPageProps) {
  const { slug } = await params;
  const data = await getTrendBySlug(slug);
  if (!data) notFound();

  const { topic, analysis, matchedMedications, purchaseLinks } = data;
  const synthesis: Analysis | null =
    analysis.synthesisJsonb != null &&
    typeof analysis.synthesisJsonb === "object" &&
    "answer" in analysis.synthesisJsonb
      ? (analysis.synthesisJsonb as Analysis)
      : null;
  const sources: SourceFragment[] = Array.isArray(analysis.sourcesJsonb)
    ? (analysis.sourcesJsonb as SourceFragment[])
    : [];
  const productMatches: ProductMatch[] = Array.isArray(
    analysis.productMatchesJsonb
  )
    ? (analysis.productMatchesJsonb as ProductMatch[])
    : [];
  const marketReaction: MarketReaction =
    analysis.marketReactionJsonb != null &&
    typeof analysis.marketReactionJsonb === "object"
      ? (analysis.marketReactionJsonb as MarketReaction)
      : { relatedQueries: [] };

  const hasProducts = productMatches.length > 0 && matchedMedications.length > 0;

  const leadText: string = synthesis?.leadExplanation ?? "";

  // Extract entity keywords for auto-linking in article body.
  // Include both ingredient names AND product-category words so
  // users can click "moisturizer", "sunscreen", "gel cream" etc.
  // — not just "hyaluronic acid".
  const understanding = analysis.understandingJsonb as {
    entities?: {
      drugs?: string[];
      genericIngredients?: string[];
      symptoms?: string[];
      conditions?: string[];
      categorySlugs?: string[];
    };
  } | null;

  // Map category slugs to display names for linking
  const categoryKeywords: string[] = (
    understanding?.entities?.categorySlugs ?? []
  ).flatMap((slug) => {
    // Convert slug like "k-beauty-moisturizers" to "moisturizer"
    const name = slug.replace(/^k-beauty-/, "").replace(/-/g, " ");
    // Also add singular form
    const singular = name.replace(/s$/, "");
    return [name, singular].filter((n) => n.length >= 3);
  });

  // Add common product-type keywords that appear in beauty/health articles
  const productTypeKeywords = [
    "moisturizer", "sunscreen", "cleanser", "serum", "toner",
    "essence", "cream", "lotion", "gel cream", "sleeping mask",
    "sheet mask", "eye cream", "lip balm", "body lotion",
    "supplement", "vitamin", "multivitamin", "probiotic",
    "pain reliever", "antihistamine", "antacid",
  ];

  // Build combined keyword list: entities + categories + product types
  // that actually appear in the lead text (avoid dead links)
  const leadLower = leadText.toLowerCase();
  const entityKeywords: string[] = [
    ...(understanding?.entities?.drugs ?? []),
    ...(understanding?.entities?.genericIngredients ?? []),
    ...(understanding?.entities?.symptoms ?? []),
    ...(understanding?.entities?.conditions ?? []),
    ...categoryKeywords,
    ...productTypeKeywords.filter((k) => leadLower.includes(k.toLowerCase())),
  ].filter((k) => k.length >= 3);

  const articleUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/trending/${slug}`;

  const heroTitle = synthesis?.headline ?? topic.queryText;
  const categoryLabel =
    topic.category === "health" ? "Health" : "Beauty & Fitness";

  return (
    <article>
      <ArticleJsonLd
        title={heroTitle}
        description={synthesis?.answer?.replace(/\[\d+\]/g, "").slice(0, 200) ?? topic.queryText}
        url={articleUrl}
        datePublished={topic.createdAt}
        dateModified={analysis.generatedAt}
        imageUrl={topic.imageUrl}
      />
      {topic.category === "health" && (
        <MedicalWebPageJsonLd
          name={heroTitle}
          description={synthesis?.answer?.replace(/\[\d+\]/g, "").slice(0, 200) ?? topic.queryText}
          url={articleUrl}
          lastReviewed={analysis.generatedAt}
          about={topic.queryText}
        />
      )}
      <BreadcrumbListJsonLd
        items={[
          { name: "Home", url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/` },
          { name: "Worth the Hype", url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/trending` },
          { name: heroTitle, url: articleUrl },
        ]}
      />

      {/* Full-bleed hero — real photo or branded AI PharmCare cover */}
      <ArticleHero
        title={heroTitle}
        category={topic.category}
        categoryLabel={categoryLabel}
        readMinutes={1}
        thumbnailUrl={topic.imageUrl}
        fallbackCover={<TrendCover category={topic.category} />}
      />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* ===== Hook — trend meta row ===== */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1 text-xs">
          <TrendingUp className="h-3 w-3" />
          {topic.rankType === "rising" ? "Rising" : "Top"}{" "}
          {categoryLabel}
          {topic.rankPosition != null ? ` #${topic.rankPosition}` : ""}
        </Badge>
        {typeof marketReaction.velocityScore === "number" && (
          <Badge variant="secondary" className="text-xs">
            +{marketReaction.velocityScore}% this week
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          Week of {topic.detectedWeek}
        </span>
      </div>

      <ReviewerByline
        lastReviewedAt={analysis.generatedAt}
      />

      {/* Trend drivers */}
      {synthesis != null && synthesis.trendDrivers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {synthesis.trendDrivers.map((driver, i) => (
            <Badge key={i} variant="outline" className="text-xs font-normal">
              Possible driver: {driver}
            </Badge>
          ))}
        </div>
      )}

      {/* ===== Section 1 — The 1-Minute Read ===== */}
      {leadText.length > 0 && synthesis != null && (
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">The 1-Minute Read</h2>
            <ConfidenceBadge level={synthesis.confidence} />
          </div>
          <div className="mt-3 leading-relaxed text-muted-foreground">
            <CitedText text={leadText} sources={sources} keywords={entityKeywords} />
          </div>
        </section>
      )}

      {/* ===== Section 2 — Why It Matters Right Now ===== */}
      <WhyNowSection
        category={topic.category}
        marketReaction={marketReaction}
      />

      {/* ===== Section 3 — Key Takeaways ===== */}
      {synthesis?.keyTakeaways && synthesis.keyTakeaways.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Key Takeaways</h2>
          <ul className="mt-3 space-y-2">
            {synthesis.keyTakeaways.map((takeaway, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span className="text-sm">
                  <CitedText text={takeaway} sources={sources} keywords={entityKeywords} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ===== Section 4 — Recommended Products ===== */}
      {hasProducts && (
        <section className="mt-10">
          <div className="mb-3 h-0.5 w-10 bg-primary" />
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Scale className="h-5 w-5 text-primary" />
            Recommended Products
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {synthesis?.productGroups && synthesis.productGroups.length > 0
              ? "Top pharmacist-reviewed picks for each step."
              : "Top pharmacist-reviewed picks mentioned in this article."}
          </p>

          {/* Role-grouped view (preferred) or flat top-5 fallback */}
          {synthesis?.productGroups && synthesis.productGroups.length > 0 ? (
            <div className="mt-6 space-y-6">
              {synthesis.productGroups.map((group, gi) => {
                const groupMeds = group.productIds
                  .map((id) => matchedMedications.find((m) => m.id === id))
                  .filter(
                    (m): m is (typeof matchedMedications)[number] =>
                      m !== undefined
                  );
                if (groupMeds.length === 0) return null;
                return (
                  <div key={gi} className="space-y-3">
                    <div>
                      <h3 className="text-base font-semibold">
                        {group.role}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {group.description}
                      </p>
                    </div>
                    <div
                      className={`grid gap-3 ${
                        groupMeds.length === 1
                          ? "sm:grid-cols-2"
                          : "grid-cols-2"
                      }`}
                    >
                      {groupMeds.map((med, mi) => {
                        const primary = purchaseLinks.find(
                          (l) => l.medicationId === med.id
                        );
                        return (
                          <RecommendedProductCard
                            key={med.id}
                            rank={mi + 1}
                            medication={med}
                            trendId={topic.id}
                            primaryLink={primary ?? null}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className={`mt-5 grid gap-3 ${
                matchedMedications.length <= 2
                  ? "grid-cols-2"
                  : matchedMedications.length === 3
                    ? "grid-cols-2 sm:grid-cols-3"
                    : matchedMedications.length === 4
                      ? "grid-cols-2 sm:grid-cols-4"
                      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
              }`}
            >
              {matchedMedications.slice(0, 5).map((med, i) => {
                const primary = purchaseLinks.find(
                  (l) => l.medicationId === med.id
                );
                return (
                  <RecommendedProductCard
                    key={med.id}
                    rank={i + 1}
                    medication={med}
                    trendId={topic.id}
                    primaryLink={primary ?? null}
                  />
                );
              })}
            </div>
          )}

          {matchedMedications.length < 3 && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Only {matchedMedications.length} pharmacist-curated match
              {matchedMedications.length === 1 ? "" : "es"} so far — more
              options may be added after pharmacist review.
            </div>
          )}
        </section>
      )}

      {/* ===== Section 5 — Ingredient Comparison across products ===== */}
      {hasProducts && (
        <ProductsIngredientsComparison
          products={matchedMedications.slice(0, 5)}
          pharmacistNote={synthesis?.pharmacistNote ?? null}
        />
      )}

      {/* ===== Section 5b — Best For / Avoid If (per matched product) ===== */}
      {hasProducts &&
        synthesis?.efficacyVerdicts &&
        synthesis.efficacyVerdicts.length > 0 && (
          <BestForAvoidIfSection
            products={matchedMedications.slice(0, 5)}
            verdicts={synthesis.efficacyVerdicts}
          />
        )}

      {/* ===== Section 6 — Safety & Real-World Data ===== */}
      <SafetySection
        category={topic.category}
        synthesis={synthesis}
        marketReaction={marketReaction}
        medication={hasProducts ? matchedMedications[0] : undefined}
      />

      {/* ===== Section 8 — People Also Search ===== */}
      {marketReaction.relatedQueries &&
        marketReaction.relatedQueries.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Related Trending Queries</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {marketReaction.relatedQueries.slice(0, 8).map((rq, i) => (
                <Link
                  key={i}
                  href={`/en/lookup?q=${encodeURIComponent(rq)}`}
                  className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {rq}
                </Link>
              ))}
            </div>
          </section>
        )}

      {/* ===== Section 9 — Sources ===== */}
      {sources.length > 0 && <SourcesSection sources={sources} />}
      </div>

      {/* Sticky Share + Weekly bar (matches every other content surface) */}
      <GlobalCtaBar
        shareData={{
          productName: heroTitle,
          verdict: synthesis?.answer?.replace(/\[\d+\]/g, "").slice(0, 200) ?? null,
          score: null,
          productImageUrl: topic.imageUrl,
          productType: categoryLabel,
          url: articleUrl,
          reviewerName: SITE_AUTHOR.displayName,
        }}
      />
    </article>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const colors = {
    high: "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
    medium:
      "border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    low: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <Badge variant="outline" className={`text-xs ${colors[level]}`}>
      {level} confidence
    </Badge>
  );
}

/**
 * Render text with inline [N] citation markers as superscript links
 * and entity keywords as topic page links (/topics/[keyword]).
 *
 * Keywords are linked only on first occurrence to avoid visual clutter.
 */
function CitedText({
  text,
  sources,
  keywords = [],
}: {
  text: string;
  sources: SourceFragment[];
  keywords?: string[];
}) {
  // Step 1: Split by citation markers [N]
  const parts = text.split(/(\[\d+\])/g);
  const linkedKeywords = new Set<string>();

  return (
    <>
      {parts.map((part, i) => {
        // Citation marker
        const citMatch = part.match(/^\[(\d+)\]$/);
        if (citMatch) {
          const idx = parseInt(citMatch[1], 10);
          const source = sources[idx];
          return (
            <sup key={i} className="mx-0.5">
              <a
                href={source?.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline decoration-dotted hover:text-blue-800 dark:text-blue-400"
                title={source?.title ?? `Source ${idx}`}
              >
                [{idx}]
              </a>
            </sup>
          );
        }

        // Apply keyword linking to plain text parts
        if (keywords.length === 0) {
          return <span key={i}>{part}</span>;
        }

        return (
          <span key={i}>
            {linkKeywordsInText(part, keywords, linkedKeywords)}
          </span>
        );
      })}
    </>
  );
}

function WhyNowSection({
  category,
  marketReaction,
}: {
  category: string;
  marketReaction: MarketReaction;
}) {
  const hasRecalls =
    marketReaction.activeRecalls && marketReaction.activeRecalls.length > 0;
  const hasRecentStudies =
    marketReaction.recentPubmedStudies &&
    marketReaction.recentPubmedStudies.length > 0;

  if (!hasRecalls && !hasRecentStudies) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Why It Matters Right Now</h2>

      {hasRecalls && (
        <div className="mt-3 space-y-2">
          {marketReaction.activeRecalls!.map((recall, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <span className="font-medium text-red-800 dark:text-red-200">
                  Active Recall ({recall.recallClass})
                </span>
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
                  {recall.reason} — {recall.firm}
                </p>
                <a
                  href={recall.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-red-600 underline hover:text-red-800"
                >
                  FDA details <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasRecentStudies && (
        <div className="mt-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Recent Research (last 30 days)
          </h3>
          <ul className="mt-2 space-y-2">
            {marketReaction.recentPubmedStudies!.map((study, i) => (
              <li key={i} className="text-sm">
                <a
                  href={study.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline decoration-dotted hover:text-blue-800 dark:text-blue-400"
                >
                  {study.title}
                </a>
                <span className="ml-2 text-xs text-muted-foreground">
                  {study.journal} ·{" "}
                  {study.publishedAt
                    ? new Date(study.publishedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Recent"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RecommendedProductCard({
  rank,
  medication,
  trendId,
  primaryLink,
}: {
  rank: number;
  medication: TrendPageData["matchedMedications"][number];
  trendId: number;
  primaryLink: TrendPageData["purchaseLinks"][number] | null;
}) {
  const priceLabel = primaryLink?.price
    ? `${primaryLink.priceCurrency === "USD" ? "$" : primaryLink.priceCurrency}${primaryLink.price}`
    : (medication.priceRange ?? "");

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-xl border bg-background transition-all hover:border-primary/40 hover:shadow-md">
      {/* Thumbnail + rank badge */}
      <Link
        href={`/analysis/${medication.slug}`}
        className="relative block aspect-square w-full overflow-hidden bg-muted"
        aria-label={`${medication.name} analysis`}
      >
        <span className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
          {rank}
        </span>
        {medication.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={medication.imageUrl}
            alt={medication.name}
            loading="lazy"
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Pill className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link
          href={`/analysis/${medication.slug}`}
          className="line-clamp-2 text-xs font-semibold leading-snug hover:text-primary"
        >
          {medication.name}
        </Link>
        {priceLabel && (
          <p className="text-xs font-medium text-primary">{priceLabel}</p>
        )}
        <div className="mt-auto">
          {primaryLink ? (
            <a
              href={`/api/click/${primaryLink.linkId}?ref=trend_article&rid=${trendId}`}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="flex w-full items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ShoppingCart className="h-3 w-3" />
              Buy{primaryLink.retailerName ? ` · ${primaryLink.retailerName}` : ""}
            </a>
          ) : (
            <Link
              href={`/analysis/${medication.slug}`}
              className="flex w-full items-center justify-center gap-1 rounded-md border bg-background px-2 py-1.5 text-[11px] font-medium transition-colors hover:border-primary/40 hover:text-primary"
            >
              View analysis
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  medication,
  matchReason,
  ingredientHighlights,
}: {
  medication: TrendPageData["matchedMedications"][number];
  matchReason?: string;
  ingredientHighlights?: string[];
}) {
  const pros = Array.isArray(medication.pros)
    ? (medication.pros as Array<{ text: string } | string>).slice(0, 3)
    : [];
  const cons = Array.isArray(medication.cons)
    ? (medication.cons as Array<{ text: string } | string>).slice(0, 3)
    : [];

  const getProConText = (item: { text: string } | string): string =>
    typeof item === "string" ? item : item.text;

  const trustLabel = medication.reviewedAt
    ? "Pharmacist verified"
    : medication.source === "fda"
      ? "FDA label"
      : "AI draft";

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-4">
        {medication.imageUrl && (
          <img
            src={medication.imageUrl}
            alt={medication.name}
            className="h-20 w-20 shrink-0 rounded-md object-cover"
          />
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">{medication.name}</h3>
              {medication.genericName && (
                <p className="text-xs text-muted-foreground">
                  {medication.genericName}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 text-xs ${
                medication.reviewedAt
                  ? "border-green-300 text-green-700"
                  : "border-gray-300 text-gray-500"
              }`}
            >
              {trustLabel}
            </Badge>
          </div>

          {medication.verdict && (
            <p className="mt-2 text-sm italic text-muted-foreground">
              &ldquo;{medication.verdict}&rdquo;
            </p>
          )}

          {ingredientHighlights && ingredientHighlights.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {ingredientHighlights.map((h, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  <FlaskConical className="mr-1 h-3 w-3" />
                  {h}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {(pros.length > 0 || cons.length > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {pros.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-700 dark:text-green-400">
                Pros
              </p>
              <ul className="mt-1 space-y-1">
                {pros.map((item, i) => (
                  <li key={i} className="flex items-start gap-1 text-xs">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                    {getProConText(item)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cons.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-700 dark:text-red-400">
                Cons
              </p>
              <ul className="mt-1 space-y-1">
                {cons.map((item, i) => (
                  <li key={i} className="flex items-start gap-1 text-xs">
                    <X className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                    {getProConText(item)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {medication.priceRange && <span>💰 {medication.priceRange}</span>}
        {medication.dosageForms && medication.dosageForms.length > 0 && (
          <span>Forms: {medication.dosageForms.join(", ")}</span>
        )}
        {matchReason && <span className="italic">{matchReason}</span>}
      </div>

      <div className="mt-3">
        <Link
          href={`/en/compare/${medication.slug}`}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          Full product details <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

interface IngredientItem {
  name?: string;
  amount?: string;
  consumer?: {
    whatItDoes?: { text: string } | string;
    howFast?: { text: string } | string;
    whoItsFor?: { text: string } | string;
    whenToAvoid?: Array<{ text: string } | string>;
    maxPerDay?: { text: string } | string;
  };
}

/**
 * Per-product ingredients grid for the trend article. Mirrors the
 * "Ingredients" subsection of Expert Picks' <ProductsAtAGlance> —
 * each matched product gets its own column of top actives, with a
 * "Shared / Only in X" chip row beneath that computes overlap across
 * products purely from the ingredient_analysis JSONB (no AI call).
 */
function ProductsIngredientsComparison({
  products,
  pharmacistNote,
}: {
  products: TrendPageData["matchedMedications"];
  pharmacistNote?: string | null;
}) {
  if (products.length === 0) return null;

  // Normalize: for each product extract up to 3 ingredient objects
  const perProduct = products.slice(0, 5).map((p) => {
    const list = Array.isArray(p.ingredientAnalysis)
      ? (p.ingredientAnalysis as IngredientItem[])
      : [];
    const ings: Array<{ name: string; amount?: string }> = [];
    for (const i of list) {
      const name = typeof i.name === "string" ? i.name : null;
      if (!name) continue;
      const amount = typeof i.amount === "string" ? i.amount : undefined;
      ings.push(amount ? { name, amount } : { name });
      if (ings.length >= 3) break;
    }
    return { product: p, ingredients: ings };
  });

  if (perProduct.every((x) => x.ingredients.length === 0)) return null;

  // Shared ingredients = name appears in 2+ products (case-insensitive)
  const counts = new Map<string, { display: string; count: number }>();
  for (const { ingredients } of perProduct) {
    const seen = new Set<string>();
    for (const ing of ingredients) {
      const key = ing.name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        counts.set(key, { display: ing.name, count: 1 });
      }
    }
  }
  const shared = Array.from(counts.values())
    .filter((v) => v.count >= 2)
    .map((v) => v.display)
    .slice(0, 6);

  const cols =
    perProduct.length <= 2
      ? "grid-cols-2"
      : perProduct.length === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : perProduct.length === 4
          ? "grid-cols-2 sm:grid-cols-4"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Ingredients at a Glance</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Top actives per product + what overlaps
      </p>

      <div className={`grid gap-3 ${cols}`}>
        {perProduct.map(({ product, ingredients }) => (
          <div key={product.id} className="rounded-lg border bg-card p-3">
            <p className="mb-2 line-clamp-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {product.name}
            </p>
            {ingredients.length > 0 ? (
              <ul className="space-y-1.5">
                {ingredients.map((ing, i) => (
                  <li key={i} className="text-sm leading-snug">
                    <span className="font-medium">{ing.name}</span>
                    {ing.amount && (
                      <span className="block text-xs text-muted-foreground">
                        {ing.amount}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ingredient data pending.
              </p>
            )}
          </div>
        ))}
      </div>

      {(pharmacistNote || shared.length > 0) && (
        <div className="mt-4 rounded-lg border-l-4 border-primary bg-muted/30 p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            Pharmacist&apos;s take
          </p>
          {pharmacistNote && (
            <p className="text-sm leading-relaxed">{pharmacistNote}</p>
          )}
          {shared.length > 0 && (
            <div
              className={`flex flex-wrap items-center gap-1.5 ${
                pharmacistNote ? "mt-3" : ""
              }`}
            >
              <span className="text-xs font-medium text-muted-foreground">
                Shared:
              </span>
              {shared.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Expert-Picks-style "Best For / Avoid If" section — per matched product
 * cards with two bullets: ✅ Best for (specific scenario) and ⚠ Avoid if
 * (trade-off pointing to another product). Data comes from
 * synthesis.efficacyVerdicts produced by Gemini.
 */
function BestForAvoidIfSection({
  products,
  verdicts,
}: {
  products: TrendPageData["matchedMedications"];
  verdicts: NonNullable<Analysis["efficacyVerdicts"]>;
}) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = verdicts
    .map((v) => ({ verdict: v, product: byId.get(v.medicationId) }))
    .filter(
      (x): x is { verdict: typeof x.verdict; product: NonNullable<typeof x.product> } =>
        !!x.product
    );
  if (rows.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Best For / Avoid If</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        When each product shines — and when another wins
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ verdict, product }) => (
          <div key={product.id} className="rounded-lg border bg-card p-4">
            <p className="mb-3 font-semibold leading-snug">{product.name}</p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="text-sm leading-snug">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    Best for:
                  </span>{" "}
                  {verdict.bestFor}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="text-sm leading-snug">
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Avoid if:
                  </span>{" "}
                  {verdict.avoidIf}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function IngredientSection({ analysis }: { analysis: unknown }) {
  const items = Array.isArray(analysis) ? (analysis as IngredientItem[]) : [];
  if (items.length === 0) return null;

  const getText = (field: { text: string } | string | undefined): string => {
    if (!field) return "";
    return typeof field === "string" ? field : field.text;
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">How It Works: Ingredients</h2>
      <div className="mt-4 space-y-4">
        {items.map((item, i) => {
          if (!item.name) return null;
          const consumer = item.consumer;
          return (
            <div key={i} className="rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-blue-600" />
                <h3 className="font-medium">
                  {item.name}
                  {item.amount && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {item.amount}
                    </span>
                  )}
                </h3>
              </div>
              {consumer && (
                <dl className="mt-3 space-y-2 text-sm">
                  {getText(consumer.whatItDoes) && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        What it does
                      </dt>
                      <dd>{getText(consumer.whatItDoes)}</dd>
                    </div>
                  )}
                  {getText(consumer.howFast) && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        How fast
                      </dt>
                      <dd>{getText(consumer.howFast)}</dd>
                    </div>
                  )}
                  {getText(consumer.whoItsFor) && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Who it&apos;s for
                      </dt>
                      <dd>{getText(consumer.whoItsFor)}</dd>
                    </div>
                  )}
                  {getText(consumer.maxPerDay) && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Max per day
                      </dt>
                      <dd>{getText(consumer.maxPerDay)}</dd>
                    </div>
                  )}
                  {consumer.whenToAvoid &&
                    Array.isArray(consumer.whenToAvoid) &&
                    consumer.whenToAvoid.length > 0 && (
                      <div>
                        <dt className="text-xs font-medium text-red-600">
                          When to avoid
                        </dt>
                        <dd>
                          <ul className="mt-1 space-y-1">
                            {consumer.whenToAvoid.map((warn, j) => (
                              <li
                                key={j}
                                className="flex items-start gap-1 text-xs"
                              >
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                                {getText(warn)}
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                </dl>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SafetySection({
  category,
  synthesis,
  marketReaction,
  medication,
}: {
  category: string;
  synthesis: Analysis | null;
  marketReaction: MarketReaction;
  medication?: TrendPageData["matchedMedications"][number];
}) {
  const hasRedFlags = synthesis?.redFlags && synthesis.redFlags.length > 0;
  const hasFaers =
    marketReaction.topReactions && marketReaction.topReactions.length > 0;
  const hasWarnings = medication?.warnings;
  const hasSideEffects = medication?.sideEffects;

  if (!hasRedFlags && !hasFaers && !hasWarnings && !hasSideEffects) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Safety Information</h2>

      {hasRedFlags && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            See a doctor if…
          </p>
          <ul className="mt-2 space-y-1">
            {synthesis!.redFlags.map((flag, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasFaers && category === "health" && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Real-World Reports (FDA FAERS, past 12 months)
          </h3>
          {marketReaction.topReactions!.map((drug, i) => (
            <div key={i} className="mt-2">
              <p className="text-xs text-muted-foreground">
                Reports for <span className="font-medium">{drug.drugName}</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {drug.reactions.map((r, j) => (
                  <Badge key={j} variant="outline" className="text-xs">
                    {r.term}{" "}
                    <span className="ml-1 text-muted-foreground">
                      ({r.count.toLocaleString()})
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          <p className="mt-2 text-xs text-muted-foreground">
            These are voluntarily reported incidents, not rates. Higher numbers
            may reflect wider use, not higher risk.
          </p>
        </div>
      )}

      {(hasWarnings || hasSideEffects) && medication && (
        <div className="mt-4 space-y-3">
          {hasWarnings && (
            <div>
              <h3 className="text-sm font-medium">FDA Warnings</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {medication.warnings!.length > 500
                  ? medication.warnings!.slice(0, 500) + "…"
                  : medication.warnings}
              </p>
            </div>
          )}
          {hasSideEffects && (
            <div>
              <h3 className="text-sm font-medium">Potential Side Effects</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {medication.sideEffects!.length > 500
                  ? medication.sideEffects!.slice(0, 500) + "…"
                  : medication.sideEffects}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SourcesSection({ sources }: { sources: SourceFragment[] }) {
  const tier1 = sources.filter((s) => s.tier === 1);
  const tier2 = sources.filter((s) => s.tier === 2);
  const tier3 = sources.filter((s) => s.tier === 3);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Sources</h2>
      <div className="mt-4 space-y-4">
        {tier1.length > 0 && (
          <SourceGroup
            title="Primary Sources"
            sources={tier1}
            color="green"
          />
        )}
        {tier2.length > 0 && (
          <SourceGroup
            title="Expert Authorities"
            sources={tier2}
            color="blue"
          />
        )}
        {tier3.length > 0 && (
          <SourceGroup
            title="Supporting Sources"
            sources={tier3}
            color="gray"
          />
        )}
      </div>
    </section>
  );
}

function SourceGroup({
  title,
  sources,
  color,
}: {
  title: string;
  sources: SourceFragment[];
  color: "green" | "blue" | "gray";
}) {
  const bgColor = {
    green: "bg-green-50 dark:bg-green-950/30",
    blue: "bg-blue-50 dark:bg-blue-950/30",
    gray: "bg-gray-50 dark:bg-gray-900/30",
  };
  return (
    <div className={`rounded-lg p-3 ${bgColor[color]}`}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ol className="space-y-2">
        {sources.map((source) => (
          <li key={source.id} className="text-sm">
            <div className="flex items-start gap-1">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                [{source.id}]
              </span>
              <div>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline decoration-dotted hover:text-blue-800 dark:text-blue-400"
                >
                  {source.title}
                </a>
                <p className="text-xs text-muted-foreground">
                  {source.citation}
                  {source.publishedAt && ` · ${source.publishedAt.slice(0, 10)}`}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Replace first occurrence of each keyword in text with a topic link.
 * Uses case-insensitive matching. Each keyword is linked only once
 * (tracked via linkedKeywords set that persists across calls).
 */
function linkKeywordsInText(
  text: string,
  keywords: string[],
  linkedKeywords: Set<string>
): React.ReactNode[] {
  // Filter to keywords not yet linked and sort by length (longest first
  // to avoid partial matches like "vitamin" matching before "vitamin c")
  const remaining = keywords
    .filter((k) => k.length >= 3 && !linkedKeywords.has(k.toLowerCase()))
    .sort((a, b) => b.length - a.length);

  if (remaining.length === 0) return [text];

  // Try to find and link the first matching keyword
  for (const keyword of remaining) {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx === -1) continue;

    linkedKeywords.add(keyword.toLowerCase());
    const before = text.slice(0, idx);
    const matched = text.slice(idx, idx + keyword.length);
    const after = text.slice(idx + keyword.length);
    const slug = keyword.toLowerCase().replace(/\s+/g, "-");

    return [
      before,
      <Link
        key={`kw-${slug}`}
        href={`/topics/${encodeURIComponent(slug)}`}
        className="font-medium text-primary underline decoration-dotted hover:text-primary/80"
      >
        {matched}
      </Link>,
      ...linkKeywordsInText(after, keywords, linkedKeywords),
    ];
  }

  return [text];
}

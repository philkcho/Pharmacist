import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Star,
  Search,
  Check,
  X,
  FlaskConical,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import {
  getTrendBySlug,
  getPublishedTrendSlugs,
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

// ============================================================
// Static params + metadata
// ============================================================

export async function generateStaticParams() {
  const slugs = await getPublishedTrendSlugs();
  return slugs.map((slug) => ({ slug }));
}

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

  return {
    title: `${data.topic.queryText} — Trending in ${data.topic.category === "health" ? "Health" : "Beauty"}`,
    description,
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

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* ===== Hook — "Why you're seeing this" ===== */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1 text-xs">
          <TrendingUp className="h-3 w-3" />
          {topic.rankType === "rising" ? "Rising" : "Top"}{" "}
          {topic.category === "health" ? "Health" : "Beauty & Fitness"}
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

      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
        {topic.queryText}
      </h1>

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

      {/* ===== AI Draft banner ===== */}
      {!topic.pharmacistReviewed && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-medium">
              AI draft — pending pharmacist review
            </span>
          </div>
          <p className="mt-1 text-xs">
            This analysis was generated by AI ({analysis.aiModel}) and has not
            yet been reviewed by a licensed pharmacist. Use it as a starting
            point, not a definitive medical resource.
          </p>
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

      {/* ===== Section 4 — Representative Products (conditional) ===== */}
      {hasProducts && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Related Products</h2>
          <div className="mt-4 space-y-4">
            {matchedMedications.slice(0, 3).map((med) => {
              const match = productMatches.find(
                (p) => p.medicationId === med.id
              );
              return (
                <ProductCard
                  key={med.id}
                  medication={med}
                  matchReason={match?.reason}
                  ingredientHighlights={match?.ingredientHighlights}
                />
              );
            })}
          </div>
          {matchedMedications.length < 3 && (
            <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Only {matchedMedications.length} pharmacist-curated match
              {matchedMedications.length === 1 ? "" : "es"} so far — more
              options may be added after pharmacist review.
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            These products are for informational purposes only. Always consult
            your pharmacist or healthcare provider before use.
          </p>

          {/* Where to Buy links */}
          {purchaseLinks.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium">Where to Buy</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {purchaseLinks.map((link) => (
                  <a
                    key={link.linkId}
                    href={`/api/click/${link.linkId}?ref=trend_article&rid=${topic.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <ShoppingCart className="h-3 w-3" />
                    {link.retailerName}
                    {link.price && (
                      <span className="text-xs text-muted-foreground">
                        {link.priceCurrency === "USD" ? "$" : link.priceCurrency}
                        {link.price}
                      </span>
                    )}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Dr.pharmacist may earn a commission from purchases made through
                these links.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ===== Section 5 — Ingredient Deep Dive (first product) ===== */}
      {hasProducts && matchedMedications[0]?.ingredientAnalysis != null && (
        <IngredientSection analysis={matchedMedications[0].ingredientAnalysis} />
      )}

      {/* ===== Section 6 — Safety & Real-World Data ===== */}
      <SafetySection
        category={topic.category}
        synthesis={synthesis}
        marketReaction={marketReaction}
        medication={hasProducts ? matchedMedications[0] : undefined}
      />

      {/* ===== Section 7 — People Ask Next ===== */}
      {synthesis?.followUpQuestions &&
        synthesis.followUpQuestions.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">People Ask Next</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {synthesis.followUpQuestions.map((q, i) => (
                <Link
                  key={i}
                  href={`/en/lookup?q=${encodeURIComponent(q)}`}
                  className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <Search className="h-3 w-3" />
                  {q}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </section>
        )}

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

      {/* ===== Section 10 — Limitations ===== */}
      {synthesis?.limitations && synthesis.limitations.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">What We Don&apos;t Know Yet</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {synthesis.limitations.map((lim, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                {lim}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ===== Footer — Review Status + Disclaimer ===== */}
      <footer className="mt-12 space-y-4">
        {topic.pharmacistReviewed && topic.reviewedAt && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span className="font-medium">
                Reviewed by pharmacist on{" "}
                {new Date(topic.reviewedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <p className="font-medium">Medical Disclaimer</p>
          <p className="mt-1">
            The information on this page is for educational purposes only and is
            not a substitute for professional medical advice. Always consult your
            healthcare provider or pharmacist before starting any new medication.
          </p>
          <p className="mt-2 text-xs">
            Generated by AI ({analysis.aiModel}) on{" "}
            {new Date(analysis.generatedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            . {!topic.pharmacistReviewed && "Not yet reviewed by a pharmacist."}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>~1 min read</span>
        </div>
      </footer>
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

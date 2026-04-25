import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FlaskConical,
  ShieldAlert,
  Check,
  X,
  Pill,
  BookOpen,
  AlertTriangle,
  ExternalLink,
  ShoppingCart,
  Beaker,
  Heart,
  Clock,
  Users,
  Ban,
  Info,
  Package,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import {
  getProductAnalysis,
  type IngredientDetail,
  type UsageGuide,
} from "@/lib/actions/analysis";
import type { Metadata } from "next";
import { ProductReviewJsonLd, BreadcrumbListJsonLd } from "@/components/seo/json-ld";
import { ReferencesSection } from "@/components/seo/references-section";
import { ReviewerByline } from "@/components/ui/reviewer-byline";
import { ScoreBadge } from "@/components/share/score-badge";
import { GlobalCtaBar } from "@/components/share/global-cta-bar";
import { SITE_AUTHOR } from "@/lib/author";

interface AnalysisPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: AnalysisPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductAnalysis(slug);
  const title = `${data.productName} — Analysis`;
  const description = data.verdict
    ? `${data.verdict.slice(0, 140)}...`
    : `Detailed ingredient analysis, pros & cons, safety information for ${data.productName}.`;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/analysis/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${data.productName} — Pharmacist Analysis`,
      description,
      url,
      type: "article",
      ...(data.imageUrl ? { images: [{ url: data.imageUrl, width: 600, height: 600 }] } : {}),
    },
    twitter: {
      card: "summary",
      title: `${data.productName} — Analysis`,
      description,
      ...(data.imageUrl ? { images: [data.imageUrl] } : {}),
    },
  };
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { slug } = await params;
  const data = await getProductAnalysis(slug);

  const typeLabel: Record<string, string> = {
    otc_drug: "OTC Drug",
    supplement: "Supplement",
    cosmetic: "Cosmetic",
    quasi_drug: "Quasi-drug",
  };

  const analysisUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/analysis/${slug}`;

  return (
    <>
      <ProductReviewJsonLd
        productName={data.productName}
        description={data.verdict ?? `Analysis of ${data.productName}`}
        url={analysisUrl}
        imageUrl={data.imageUrl}
        pros={data.pros}
        cons={data.cons}
      />
      <BreadcrumbListJsonLd
        items={[
          { name: "Home", url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/` },
          { name: "Product Analysis", url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com"}/` },
          { name: data.productName, url: analysisUrl },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
        {/* Product Header */}
        <div className="flex items-start gap-5">
          {data.imageUrl ? (
            <img
              src={data.imageUrl}
              alt={data.productName}
              className="h-24 w-24 shrink-0 rounded-xl border object-cover sm:h-32 sm:w-32"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border bg-muted sm:h-32 sm:w-32">
              <Pill className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  {data.productName}
                </h1>
                {data.genericName && (
                  <p className="mt-1 text-muted-foreground">{data.genericName}</p>
                )}
              </div>
              {/* Buy button — shows the referrer retailer */}
              {data.purchaseOptions.length > 0 && (
                <a
                  href={`/api/click/${data.purchaseOptions[0].linkId}?ref=analysis_page`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm">
                    <ShoppingCart className="mr-1.5 h-4 w-4" />
                    Buy on {data.purchaseOptions[0].retailerName}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </a>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {data.productType !== "unknown" && (
                <Badge variant="outline">
                  {typeLabel[data.productType] ?? data.productType}
                </Badge>
              )}
              {data.priceRange && (
                <Badge variant="secondary">{data.priceRange}</Badge>
              )}
              {data.brandNames?.slice(0, 3).map((b, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {b}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <ReviewerByline className="mt-4" />

        {/* Score Badge — Yuka-style at-a-glance evaluation */}
        {data.comparisonScore !== null && (
          <div className="mt-6 rounded-xl border bg-card p-5">
            <ScoreBadge
              score={data.comparisonScore}
              rationale={data.scoringRationale}
              size="lg"
              showReviewer={true}
            />
          </div>
        )}

        {/* Verdict */}
        {data.verdict && (
          <div className="mt-6 rounded-lg border-l-4 border-primary bg-primary/5 p-4">
            <p className="text-sm font-medium text-primary">
              Pharmacist&apos;s Verdict
            </p>
            <p className="mt-1 text-muted-foreground">{data.verdict}</p>
          </div>
        )}

        {/* Not found banner */}
        {!data.found && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-medium">
                This product has not been reviewed by a pharmacist yet.
              </span>
            </div>
            <p className="mt-1 text-xs">
              Detailed analysis is pending. You can still browse and purchase
              from the retailers below.
            </p>
          </div>
        )}

        {/* ===== Ingredient Analysis ===== */}
        {data.ingredients.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Beaker className="h-5 w-5 text-primary" />
              Ingredient Analysis
            </h2>
            <IngredientsTable ingredients={data.ingredients} />
          </section>
        )}

        {/* ===== Pros & Cons ===== */}
        {(data.pros.length > 0 || data.cons.length > 0) && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Heart className="h-5 w-5 text-primary" />
              Pros &amp; Cons
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {data.pros.length > 0 && (
                <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-900 dark:bg-green-950/30">
                  <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">
                    Pros
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {data.pros.map((pro, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.cons.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/30">
                  <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
                    Cons
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {data.cons.map((con, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm"
                      >
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        {con}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ===== Usage Guide & Precautions ===== */}
        {data.usageGuide && (
          <UsageGuideSection
            guide={data.usageGuide}
            productType={data.productType}
          />
        )}

        {/* ===== Safety & Warnings ===== */}
        {(data.warnings || data.sideEffects) && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              Safety Information
            </h2>
            <div className="mt-4 space-y-4">
              {data.warnings && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
                  <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                    Warnings
                  </h3>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {data.warnings.length > 800
                      ? data.warnings.slice(0, 800) + "…"
                      : data.warnings}
                  </p>
                </div>
              )}
              {data.sideEffects && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Potential Side Effects
                  </h3>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    {data.sideEffects.length > 800
                      ? data.sideEffects.slice(0, 800) + "…"
                      : data.sideEffects}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold">
                Is {data.productName} safe for you?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                See pregnancy, interactions, and common concerns answered in
                our pharmacist safety FAQ.
              </p>
              <Link
                href={`/is-safe/${slug}`}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Read safety review →
              </Link>
            </div>
          </section>
        )}

        {/* ===== Research & References ===== */}
        {data.references.length > 0 ? (
          <ReferencesSection references={data.references} className="mt-8" />
        ) : (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <BookOpen className="h-5 w-5 text-primary" />
              Research &amp; References
            </h2>
            <p className="mt-3 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              {data.found
                ? "FDA and PubMed citations are being compiled for this product."
                : "Detailed research references will be available once this product is reviewed by a pharmacist."}
            </p>
          </section>
        )}

      </div>

      {/* Single sticky bottom bar: Buy + Share + Subscribe */}
      <GlobalCtaBar
        shareData={{
          productName: data.productName,
          verdict: data.verdict,
          score: data.comparisonScore,
          productImageUrl: data.imageUrl,
          productType: typeLabel[data.productType] ?? data.productType,
          url: analysisUrl,
          reviewerName: SITE_AUTHOR.displayName,
        }}
        purchaseOptions={
          data.purchaseOptions.length > 0
            ? [
                {
                  linkId: data.purchaseOptions[0].linkId,
                  retailerName: data.purchaseOptions[0].retailerName,
                },
              ]
            : undefined
        }
      />
    </>
  );
}

// ============================================================
// Usage Guide & Precautions
// ============================================================

function howToUseLabel(productType: string): string {
  switch (productType) {
    case "supplement":
    case "otc_drug":
      return "How to Take";
    case "cosmetic":
      return "How to Apply";
    case "quasi_drug":
    default:
      return "How to Use";
  }
}

function UsageGuideSection({
  guide,
  productType,
}: {
  guide: UsageGuide;
  productType: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Info className="h-5 w-5 text-primary" />
        Usage Guide &amp; Precautions
      </h2>

      <ul className="mt-4 space-y-4">
        {guide.howToUse && (
          <li className="flex gap-3 rounded-lg border p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">
                {howToUseLabel(productType)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {guide.howToUse}
              </p>
            </div>
          </li>
        )}

        {guide.storage && (
          <li className="flex gap-3 rounded-lg border p-4">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">Storage</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {guide.storage}
              </p>
            </div>
          </li>
        )}

        {guide.precautions && (
          <li className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Precautions
              </h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                {guide.precautions}
              </p>
            </div>
          </li>
        )}
      </ul>

      {guide.tip && (
        <div className="mt-4 flex gap-3 rounded-lg border-l-4 border-primary bg-primary/5 p-4">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Pharmacist&apos;s Tip
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{guide.tip}</p>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================
// Ingredients Table (scannable 2-column layout)
// ============================================================

function IngredientsTable({ ingredients }: { ingredients: IngredientDetail[] }) {
  const hasAnyDetails = ingredients.some(
    (ing) =>
      ing.howFast ||
      ing.whoItsFor ||
      ing.maxPerDay ||
      (ing.whenToAvoid && ing.whenToAvoid.length > 0) ||
      ing.mechanism ||
      ing.clinicalNotes
  );

  return (
    <>
      {/* Desktop: table layout */}
      <div className="mt-4 hidden overflow-hidden rounded-lg border sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-[40%] px-4 py-3 text-left font-medium">
                Ingredient
              </th>
              <th className="px-4 py-3 text-left font-medium">
                Role &amp; Characteristics
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ingredients.map((ing, i) => (
              <tr key={i} className="align-top">
                <td className="px-4 py-3">
                  <div className="font-semibold">{ing.name}</div>
                  {ing.amount && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {ing.amount}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {ing.whatItDoes || (
                    <span className="italic opacity-60">
                      Details pending pharmacist review.
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="mt-4 space-y-3 sm:hidden">
        {ingredients.map((ing, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-semibold">{ing.name}</div>
              {ing.amount && (
                <div className="text-xs text-muted-foreground">
                  {ing.amount}
                </div>
              )}
            </div>
            {ing.whatItDoes ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {ing.whatItDoes}
              </p>
            ) : (
              <p className="mt-2 text-xs italic text-muted-foreground/70">
                Details pending pharmacist review.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Expandable detailed profiles */}
      {hasAnyDetails && (
        <details className="group mt-4">
          <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-primary hover:underline">
            View detailed ingredient profiles
            <span className="transition-transform group-open:rotate-90">→</span>
          </summary>
          <div className="mt-4 space-y-4">
            {ingredients.map((ing, i) => (
              <IngredientDetailCard key={i} ingredient={ing} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}

// ============================================================
// Ingredient Detail Card (shown inside expandable panel)
// ============================================================

function IngredientDetailCard({
  ingredient,
}: {
  ingredient: IngredientDetail;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Beaker className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">{ingredient.name}</h3>
        {ingredient.amount && (
          <Badge variant="secondary" className="text-xs">
            {ingredient.amount}
          </Badge>
        )}
      </div>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {ingredient.whatItDoes && (
          <div>
            <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Heart className="h-3 w-3" /> What it does
            </dt>
            <dd className="mt-0.5 text-sm">{ingredient.whatItDoes}</dd>
          </div>
        )}
        {ingredient.howFast && (
          <div>
            <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Clock className="h-3 w-3" /> How fast
            </dt>
            <dd className="mt-0.5 text-sm">{ingredient.howFast}</dd>
          </div>
        )}
        {ingredient.whoItsFor && (
          <div>
            <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Users className="h-3 w-3" /> Who it&apos;s for
            </dt>
            <dd className="mt-0.5 text-sm">{ingredient.whoItsFor}</dd>
          </div>
        )}
        {ingredient.maxPerDay && (
          <div>
            <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Pill className="h-3 w-3" /> Max per day
            </dt>
            <dd className="mt-0.5 text-sm">{ingredient.maxPerDay}</dd>
          </div>
        )}
      </dl>

      {ingredient.whenToAvoid && ingredient.whenToAvoid.length > 0 && (
        <div className="mt-3 rounded border border-red-200 bg-red-50/50 p-2 dark:border-red-900 dark:bg-red-950/30">
          <p className="flex items-center gap-1 text-xs font-medium text-red-700">
            <Ban className="h-3 w-3" /> When to avoid
          </p>
          <ul className="mt-1 space-y-1">
            {ingredient.whenToAvoid.map((w, i) => (
              <li key={i} className="flex items-start gap-1 text-xs text-red-600">
                <span>•</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(ingredient.mechanism || ingredient.clinicalNotes) && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Professional Details
          </summary>
          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
            {ingredient.mechanism && (
              <p>
                <span className="font-medium">Mechanism:</span>{" "}
                {ingredient.mechanism}
              </p>
            )}
            {ingredient.clinicalNotes && (
              <p>
                <span className="font-medium">Clinical Notes:</span>{" "}
                {ingredient.clinicalNotes}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pill,
  ExternalLink,
  FlaskConical,
  TrendingUp,
  ShoppingCart,
  ArrowRight,
  Search,
  Star,
  Store,
} from "lucide-react";
import Link from "next/link";
import {
  getTopicByKeyword,
  type TopicProduct,
  type RetailerSearchLink,
  type RetailerSection,
  type RetailerProduct,
} from "@/lib/actions/topics";
import type { Metadata } from "next";

interface TopicPageProps {
  params: Promise<{ keyword: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: TopicPageProps): Promise<Metadata> {
  const { keyword } = await params;
  const decoded = decodeURIComponent(keyword).replace(/-/g, " ");
  const title = decoded.charAt(0).toUpperCase() + decoded.slice(1);
  return {
    title: `${title} — Products & Analysis — Dr.pharmacist`,
    description: `Explore ${title}: pharmacist-analyzed products, ingredient details, and where to buy from Amazon, iHerb, StyleKorean.`,
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { keyword } = await params;
  const data = await getTopicByKeyword(keyword);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{data.displayKeyword}</h1>
        <p className="mt-2 text-muted-foreground">
          Pharmacist-reviewed products, detailed ingredient analysis, and where
          to buy.
        </p>
      </div>

      {/* Pharmacist-Curated Products */}
      {data.products.length > 0 && (
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <FlaskConical className="h-5 w-5 text-primary" />
            Pharmacist-Reviewed Products
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Products analyzed by our pharmacist team — ingredients, pros &amp;
            cons, and safety information.
          </p>
          <div className="mt-4 space-y-4">
            {data.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Retailer Product Listings */}
      {data.retailerSections.length > 0 && (
        <div className="mb-10 space-y-10">
          {data.retailerSections.map((section) => (
            <RetailerProductSection key={section.retailerSlug} section={section} />
          ))}
          <p className="text-xs text-muted-foreground">
            Dr.pharmacist may earn a commission from purchases made through
            these links. Prices and availability are subject to change.
          </p>
        </div>
      )}

      {/* No products at all */}
      {data.products.length === 0 && data.retailerSearchLinks.length === 0 && (
        <section className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Search className="mx-auto h-8 w-8 opacity-50" />
          <p className="mt-2">
            No products found for &ldquo;{data.displayKeyword}&rdquo; yet.
          </p>
          <p className="mt-1 text-sm">
            Products are being reviewed — check back soon.
          </p>
        </section>
      )}

      {/* Related Trends */}
      {data.relatedTrends.length > 0 && (
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" />
            Related Trending Articles
          </h2>
          <div className="mt-4 space-y-3">
            {data.relatedTrends.map((trend) => (
              <Link
                key={trend.id}
                href={`/trending/${trend.slug}`}
                className="group flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div>
                  <h3 className="font-medium group-hover:text-primary">
                    {trend.queryText}
                  </h3>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {trend.category === "health" ? "Health" : "Beauty"}
                  </Badge>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Disclaimer */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
        <p className="font-medium">Medical Disclaimer</p>
        <p className="mt-1">
          Product information is for educational purposes only. Always consult
          your healthcare provider or pharmacist before starting any new
          medication or supplement.
        </p>
        <p className="mt-1 text-xs">
          Dr.pharmacist may earn a commission from purchases made through
          retailer links.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Product Card — detailed, with image, description, actions
// ============================================================

function ProductCard({ product }: { product: TopicProduct }) {
  const typeLabel =
    product.productType === "cosmetic"
      ? "Cosmetic"
      : product.productType === "supplement"
        ? "Supplement"
        : product.productType === "quasi_drug"
          ? "Quasi-drug"
          : "OTC Drug";

  const typeColor =
    product.productType === "cosmetic"
      ? "border-pink-300 text-pink-700"
      : product.productType === "supplement"
        ? "border-green-300 text-green-700"
        : "border-blue-300 text-blue-700";

  return (
    <div className="overflow-hidden rounded-lg border transition-shadow hover:shadow-md">
      <div className="flex flex-col sm:flex-row">
        {/* Image — larger, left side */}
        <div className="flex shrink-0 items-center justify-center bg-muted/30 p-4 sm:w-40">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-32 w-32 rounded-lg object-cover sm:h-28 sm:w-28"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-muted">
              <Pill className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Content — right side */}
        <div className="flex flex-1 flex-col p-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold leading-snug">
                {product.name}
              </h3>
              {product.genericName && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {product.genericName}
                </p>
              )}
            </div>
            <Badge variant="outline" className={`shrink-0 text-xs ${typeColor}`}>
              {typeLabel}
            </Badge>
          </div>

          {/* One-line description / verdict */}
          {(product.verdict || product.description) && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {product.verdict ?? product.description}
            </p>
          )}

          {/* Price + brands */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {product.priceRange && (
              <Badge variant="secondary" className="text-xs">
                {product.priceRange}
              </Badge>
            )}
            {product.brandNames &&
              product.brandNames.slice(0, 2).map((b, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {b}
                </Badge>
              ))}
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Detailed Analysis button — primary CTA */}
            <Button
              size="sm"
              variant="default"
              render={<Link href={`/compare/${product.slug}`} />}
            >
              <FlaskConical className="mr-1.5 h-4 w-4" />
              Detailed Analysis
            </Button>

            {/* Purchase links per retailer */}
            {product.purchaseLinks.map((link) => (
              <Button
                key={link.linkId}
                variant="outline"
                size="sm"
                render={
                  <a
                    href={`/api/click/${link.linkId}?ref=topic_page`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                {link.retailerName}
                <ExternalLink className="ml-1 h-3 w-3 opacity-50" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Retailer Product Section — 5 products per retailer
// ============================================================

function RetailerProductSection({ section }: { section: RetailerSection }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <span className="text-2xl">{section.emoji}</span>
          {section.retailerName} Top Picks
        </h2>
        <a
          href={section.searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          See all on {section.retailerName}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {section.products.slice(0, 5).map((product, i) => (
          <RetailerProductCard key={i} product={product} />
        ))}
      </div>
    </section>
  );
}

function RetailerProductCard({ product }: { product: RetailerProduct }) {
  return (
    <a
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-lg border transition-all hover:border-primary/30 hover:shadow-md"
    >
      {/* Image */}
      <div className="flex h-40 items-center justify-center bg-white p-3">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <Pill className="h-12 w-12 text-muted-foreground/20" />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {product.description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm font-semibold text-primary">
            {product.price}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
            Buy <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </div>
    </a>
  );
}

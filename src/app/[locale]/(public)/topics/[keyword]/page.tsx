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
  Store,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import {
  getTopicByKeyword,
  type TopicProduct,
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

  // Collect all product names across retailers for "select product" analysis
  const allRetailerProducts = data.retailerSections.flatMap((s) =>
    s.products.map((p) => ({ ...p, retailer: s.retailerName }))
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header + Analysis buttons */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{data.displayKeyword}</h1>
        <p className="mt-2 text-muted-foreground">
          Top products by retailer — compare, analyze, and buy.
        </p>

        {/* Analysis action bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            render={
              <Link
                href={`/compare/${keyword}`}
              />
            }
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Analyze All Products
          </Button>

          {data.products.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                or select a product:
              </span>
              {data.products.slice(0, 5).map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  render={<Link href={`/compare/${p.slug}`} />}
                >
                  <FlaskConical className="mr-1 h-3 w-3" />
                  {p.name.length > 20 ? p.name.slice(0, 20) + "…" : p.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Retailer Product Listings — horizontal scroll per retailer */}
      {data.retailerSections.length > 0 && (
        <div className="space-y-8">
          {data.retailerSections.map((section) => (
            <RetailerRow key={section.retailerSlug} section={section} />
          ))}
        </div>
      )}

      {/* No products at all */}
      {data.retailerSections.length === 0 && data.products.length === 0 && (
        <section className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Search className="mx-auto h-8 w-8 opacity-50" />
          <p className="mt-2">
            No products found for &ldquo;{data.displayKeyword}&rdquo; yet.
          </p>
        </section>
      )}

      {/* Pharmacist-Curated Products (if any approved in DB) */}
      {data.products.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <FlaskConical className="h-5 w-5 text-primary" />
            Pharmacist-Reviewed
          </h2>
          <div className="mt-4 space-y-3">
            {data.products.map((product) => (
              <PharmacistProductRow key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Related Trends */}
      {data.relatedTrends.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" />
            Related Articles
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.relatedTrends.map((trend) => (
              <Link
                key={trend.id}
                href={`/trending/${trend.slug}`}
                className="rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                {trend.queryText}
                <ArrowRight className="ml-1 inline h-3 w-3" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Disclaimer */}
      <div className="mt-10 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
        <p className="font-medium">Disclaimer</p>
        <p className="mt-1">
          Product information is for educational purposes only. Always consult
          your pharmacist before use. Dr.pharmacist may earn a commission from
          purchases.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Retailer row — horizontal scroll of 5 products
// ============================================================

function RetailerRow({ section }: { section: RetailerSection }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="text-xl">{section.emoji}</span>
          {section.retailerName}
        </h2>
        <a
          href={section.searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          See all <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Horizontal scroll row */}
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
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
      className="group flex w-40 shrink-0 flex-col overflow-hidden rounded-lg border transition-all hover:border-primary/30 hover:shadow-md"
    >
      {/* Image — square, white bg */}
      <div className="flex h-36 items-center justify-center bg-white p-2">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <Pill className="h-10 w-10 text-muted-foreground/20" />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-2">
        <h3 className="line-clamp-2 text-xs font-medium leading-snug group-hover:text-primary">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
          {product.description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-1.5">
          <span className="text-sm font-bold text-primary">
            {product.price}
          </span>
          <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
        </div>
      </div>
    </a>
  );
}

// ============================================================
// Pharmacist-reviewed product row (compact)
// ============================================================

function PharmacistProductRow({ product }: { product: TopicProduct }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/30">
      {/* Thumbnail */}
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-14 w-14 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
          <Pill className="h-6 w-6 text-muted-foreground/30" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="truncate font-medium">{product.name}</h3>
        {product.verdict && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {product.verdict}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="default"
          render={<Link href={`/compare/${product.slug}`} />}
        >
          <FlaskConical className="mr-1 h-3.5 w-3.5" />
          Analysis
        </Button>
        {product.purchaseLinks.slice(0, 2).map((link) => (
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
            <ShoppingCart className="mr-1 h-3 w-3" />
            {link.retailerName}
          </Button>
        ))}
      </div>
    </div>
  );
}

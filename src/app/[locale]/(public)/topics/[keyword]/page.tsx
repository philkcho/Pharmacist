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
} from "lucide-react";
import Link from "next/link";
import { getTopicByKeyword, type TopicProduct } from "@/lib/actions/topics";
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
    description: `Explore ${title}: pharmacist-analyzed products, ingredient details, and where to buy.`,
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { keyword } = await params;
  const data = await getTopicByKeyword(keyword);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{data.displayKeyword}</h1>
        <p className="mt-2 text-muted-foreground">
          Products, analysis, and where to buy — reviewed by pharmacists.
        </p>
      </div>

      {/* Products */}
      {data.products.length > 0 ? (
        <section>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Pill className="h-5 w-5 text-primary" />
            Top Products ({data.products.length})
          </h2>
          <div className="mt-4 space-y-4">
            {data.products.map((product) => (
              <TopicProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Search className="mx-auto h-8 w-8 opacity-50" />
          <p className="mt-2">
            No pharmacist-approved products found for &ldquo;
            {data.displayKeyword}&rdquo; yet.
          </p>
          <p className="mt-1 text-sm">
            Products are being reviewed — check back soon.
          </p>
        </section>
      )}

      {/* Related Trends */}
      {data.relatedTrends.length > 0 && (
        <section className="mt-10">
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
      <div className="mt-10 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
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

function TopicProductCard({ product }: { product: TopicProduct }) {
  const typeLabel =
    product.productType === "cosmetic"
      ? "Cosmetic"
      : product.productType === "supplement"
        ? "Supplement"
        : product.productType === "quasi_drug"
          ? "Quasi-drug"
          : "OTC Drug";

  return (
    <div className="rounded-lg border p-5">
      <div className="flex items-start gap-4">
        {/* Image */}
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-20 w-20 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-muted">
            <Pill className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{product.name}</h3>
          {product.genericName && (
            <p className="text-sm text-muted-foreground">
              {product.genericName}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {typeLabel}
            </Badge>
            {product.priceRange && (
              <span className="text-sm text-muted-foreground">
                {product.priceRange}
              </span>
            )}
          </div>
          {product.verdict && (
            <p className="mt-2 text-sm italic text-muted-foreground">
              &ldquo;{product.verdict}&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Product analysis button */}
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/compare/${product.slug}`} />}
        >
          <FlaskConical className="mr-1 h-4 w-4" />
          Product Analysis
        </Button>

        {/* Purchase links */}
        {product.purchaseLinks.map((link) => (
          <Button
            key={link.linkId}
            variant="default"
            size="sm"
            render={
              <a
                href={`/api/click/${link.linkId}?ref=topic_page`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ShoppingCart className="mr-1 h-4 w-4" />
            {link.retailerName}
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        ))}

        {product.purchaseLinks.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Purchase links coming soon
          </span>
        )}
      </div>
    </div>
  );
}

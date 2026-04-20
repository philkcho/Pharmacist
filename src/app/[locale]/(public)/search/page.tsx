import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Pill,
  Search,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `"${q}" — Search — Dr.pharmacist` : "Search — Dr.pharmacist",
    alternates: { canonical: "/search" },
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  if (!query) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
        <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h1 className="mt-4 text-2xl font-bold">Search Dr.pharmacist</h1>
        <p className="mt-2 text-muted-foreground">
          Enter a keyword above to find trending topics and products.
        </p>
      </div>
    );
  }

  const supabase = await createClient();

  // Search trends (published only, RLS enforced)
  const { data: trends } = await supabase
    .from("trend_topics")
    .select("id, query_text, slug, category, rank_type, detected_week, pharmacist_reviewed")
    .eq("status", "published")
    .ilike("query_text", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  // Search products (approved only, RLS enforced)
  const { data: products } = await supabase
    .from("medications")
    .select("id, name, slug, generic_name, brand_names, image_url, product_type, price_range")
    .or(`name.ilike.%${query}%,generic_name.ilike.%${query}%`)
    .order("comparison_score", { ascending: false, nullsFirst: true })
    .limit(10);

  const hasResults = (trends?.length ?? 0) > 0 || (products?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">
        Results for &ldquo;{query}&rdquo;
      </h1>

      {!hasResults && (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Search className="mx-auto h-8 w-8 opacity-50" />
          <p className="mt-2">No results found for &ldquo;{query}&rdquo;</p>
          <p className="mt-1 text-sm">
            Try a different keyword, or{" "}
            <Link href={`/topics/${encodeURIComponent(query.toLowerCase().replace(/\s+/g, "-"))}`} className="text-primary underline">
              explore this topic
            </Link>
            .
          </p>
        </div>
      )}

      {/* Trending Articles */}
      {trends && trends.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trending Articles
          </h2>
          <div className="mt-3 space-y-3">
            {trends.map((t) => (
              <Link
                key={t.id}
                href={`/trending/${t.slug}`}
                className="group block rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {(t.rank_type as string) === "rising" ? "Rising" : "Top"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {(t.category as string) === "health" ? "Health" : "Beauty"}
                  </Badge>
                  {!(t.pharmacist_reviewed as boolean) && (
                    <Badge variant="outline" className="border-amber-300 text-xs text-amber-700">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      AI draft
                    </Badge>
                  )}
                </div>
                <h3 className="mt-2 font-medium group-hover:text-primary">
                  {t.query_text as string}
                </h3>
                <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Week of {t.detected_week as string}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      {products && products.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Pill className="h-5 w-5 text-primary" />
            Products
          </h2>
          <div className="mt-3 space-y-3">
            {products.map((p) => (
              <Link
                key={p.id as number}
                href={`/topics/${encodeURIComponent((p.name as string).toLowerCase().replace(/\s+/g, "-"))}`}
                className="group flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                {p.image_url ? (
                  <img
                    src={p.image_url as string}
                    alt={p.name as string}
                    className="h-14 w-14 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Pill className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-medium group-hover:text-primary">
                    {p.name as string}
                  </h3>
                  {p.generic_name && (
                    <p className="text-xs text-muted-foreground">
                      {p.generic_name as string}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {(p.product_type as string) === "cosmetic"
                        ? "Cosmetic"
                        : (p.product_type as string) === "supplement"
                          ? "Supplement"
                          : "OTC Drug"}
                    </Badge>
                    {p.price_range && (
                      <span className="text-xs text-muted-foreground">
                        {p.price_range as string}
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

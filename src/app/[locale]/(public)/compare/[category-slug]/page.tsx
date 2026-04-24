import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  FileWarning,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import {
  getMedicationsByCategorySlug,
  type CompareMedicationRow,
} from "@/lib/actions/medications";

interface PageProps {
  params: Promise<{ locale: string; "category-slug": string }>;
}

/**
 * `/compare/[category-slug]` — public product comparison page.
 *
 * Shows a comparison table of featured medications in the category,
 * followed by the full product list. Implements section 6.2 of
 * docs/compare-feature.md.
 */
export default async function CompareCategoryPage({ params }: PageProps) {
  const { "category-slug": categorySlug } = await params;

  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug, description")
    .eq("slug", categorySlug)
    .maybeSingle();

  if (!category) notFound();

  const medications = await getMedicationsByCategorySlug(categorySlug);

  const featured = medications.filter((m) => m.is_featured);
  const nonFeatured = medications.filter((m) => !m.is_featured);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/" />}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Home
      </Button>

      {/* Hero */}
      <div className="mb-8">
        <p className="text-sm font-medium uppercase text-primary">
          Compare products
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
            {category.description}
          </p>
        )}
      </div>

      {/* Empty state */}
      {medications.length === 0 && (
        <div className="rounded-md border border-dashed bg-muted/30 p-10 text-center">
          <p className="font-medium">No products curated yet for this category.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;re working on adding pharmacist-reviewed products here. In
            the meantime, try the Product Lookup on the home page.
          </p>
          <Button variant="outline" className="mt-4" render={<Link href="/" />}>
            Back to home
          </Button>
        </div>
      )}

      {/* Featured comparison table (desktop) */}
      {featured.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold">Top picks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Side-by-side comparison of pharmacist-reviewed favorites in this
            category.
          </p>

          {/* Desktop: horizontal comparison table */}
          <div className="mt-4 hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Best for</th>
                  <th className="px-4 py-3 text-left font-medium">Key ingredient</th>
                  <th className="px-4 py-3 text-left font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {featured.map((med) => (
                  <FeaturedRow
                    key={med.id}
                    medication={med}
                    categorySlug={categorySlug}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="mt-4 space-y-3 md:hidden">
            {featured.map((med) => (
              <FeaturedCardMobile
                key={med.id}
                medication={med}
                categorySlug={categorySlug}
              />
            ))}
          </div>
        </section>
      )}

      {/* All products */}
      {nonFeatured.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold">All products</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every {category.name.toLowerCase()} product in our database,
            including FDA-synced records awaiting review.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nonFeatured.map((med) => (
              <ProductCard
                key={med.id}
                medication={med}
                categorySlug={categorySlug}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function normalizeActiveIngredients(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): string | null => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item) {
        const name = (item as { name?: unknown }).name;
        return typeof name === "string" ? name : null;
      }
      return null;
    })
    .filter((s): s is string => s !== null && s.length > 0);
}

function firstRecommendedFor(med: CompareMedicationRow): string {
  const rf = med.recommended_for ?? [];
  return rf.length > 0 ? rf[0]! : "—";
}

function keyIngredient(med: CompareMedicationRow): string {
  const ings = normalizeActiveIngredients(med.active_ingredients);
  return ings.length > 0 ? ings[0]! : "—";
}

function FeaturedRow({
  medication,
  categorySlug,
}: {
  medication: CompareMedicationRow;
  categorySlug: string;
}) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link
          href={`/compare/${categorySlug}/${medication.slug}`}
          className="font-medium hover:text-primary hover:underline"
        >
          {medication.name}
        </Link>
        {medication.generic_name && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {medication.generic_name}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {firstRecommendedFor(medication)}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {keyIngredient(medication)}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {medication.price_range ?? "—"}
      </td>
      <td className="px-4 py-3 text-right">
        {medication.comparison_score !== null ? (
          <Badge className="bg-primary text-primary-foreground">
            {medication.comparison_score}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

function FeaturedCardMobile({
  medication,
  categorySlug,
}: {
  medication: CompareMedicationRow;
  categorySlug: string;
}) {
  const ingredient = keyIngredient(medication);
  const bestFor = firstRecommendedFor(medication);

  return (
    <Link href={`/compare/${categorySlug}/${medication.slug}`}>
      <Card className="transition-colors hover:bg-accent">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{medication.name}</h3>
              {medication.generic_name && (
                <p className="truncate text-xs text-muted-foreground">
                  {medication.generic_name}
                </p>
              )}
            </div>
            {medication.comparison_score !== null && (
              <Badge className="shrink-0 bg-primary text-primary-foreground">
                {medication.comparison_score}
              </Badge>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="font-semibold uppercase text-muted-foreground">
                Best for
              </dt>
              <dd>{bestFor}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase text-muted-foreground">
                Key ingredient
              </dt>
              <dd>{ingredient}</dd>
            </div>
            {medication.price_range && (
              <div className="col-span-2">
                <dt className="font-semibold uppercase text-muted-foreground">
                  Price
                </dt>
                <dd>{medication.price_range}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </Link>
  );
}

function ProductCard({
  medication,
  categorySlug,
}: {
  medication: CompareMedicationRow;
  categorySlug: string;
}) {
  const isReviewed =
    medication.source === "manual" || medication.reviewed_at !== null;
  const ingredient = keyIngredient(medication);

  return (
    <Link href={`/compare/${categorySlug}/${medication.slug}`}>
      <Card className="h-full transition-colors hover:bg-accent">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">
              {medication.name}
            </CardTitle>
            {isReviewed ? (
              <Badge className="shrink-0 gap-1 bg-emerald-600 hover:bg-emerald-700">
                <ShieldCheck className="h-3 w-3" />
                Reviewed
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <FileWarning className="h-3 w-3" />
                FDA only
              </Badge>
            )}
          </div>
          {medication.generic_name && (
            <p className="text-xs text-muted-foreground">
              {medication.generic_name}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0 text-sm">
          {medication.description && (
            <p className="line-clamp-2 text-muted-foreground">
              {medication.description}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{ingredient}</span>
            {medication.fda_spl_id && (
              <span className="inline-flex items-center gap-1 text-primary">
                FDA <ExternalLink className="h-3 w-3" />
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

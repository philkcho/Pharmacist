import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCategories } from "@/lib/actions/categories";
import {
  getFeaturedMedications,
  getMedicationCountsByCategory,
} from "@/lib/actions/medications";

const categoryEmojis: Record<string, string> = {
  "pain-relief": "💊",
  "cold-flu": "🤧",
  "digestive-health": "🫁",
  allergy: "🌸",
  "vitamins-supplements": "🍊",
  "skin-care": "✨",
  "skin-care-beauty": "✨",
  "sleep-relaxation": "😴",
  "first-aid": "🩹",
  "oral-care": "🦷",
};

/**
 * `/compare` — hub page for the product comparison feature.
 *
 * Lists every category with a product count, then shows an
 * "Editor's Picks" grid of featured products across all categories.
 */
export default async function CompareHubPage() {
  const [categories, featured, counts] = await Promise.all([
    getCategories(),
    getFeaturedMedications(6),
    getMedicationCountsByCategory(),
  ]);

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
      <div className="mb-10">
        <p className="text-sm font-medium uppercase text-primary">
          Compare Products
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Side-by-side OTC comparisons
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
          Pharmacist-reviewed comparisons of over-the-counter medications. Every
          claim is linked to FDA, PubMed, and other authoritative sources — no
          paid rankings, ever.
        </p>
      </div>

      {/* Category grid */}
      <section>
        <h2 className="text-xl font-semibold">Browse by category</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const count = counts[category.id] ?? 0;
            return (
              <Link
                key={category.id}
                href={`/compare/${category.slug}`}
              >
                <Card className="h-full transition-colors hover:bg-accent">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          {categoryEmojis[category.slug] ?? "💊"}
                        </span>
                        <CardTitle className="text-lg">
                          {category.name}
                        </CardTitle>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {category.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {category.description}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {count === 0
                        ? "No products yet"
                        : count === 1
                          ? "1 product"
                          : `${count} products`}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Editor's Picks */}
      {featured.length > 0 && (
        <section className="mt-12 border-t pt-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Editor&apos;s Picks</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Top pharmacist-reviewed products across all categories.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((med) => {
              // Featured rows don't include category slug in the SELECT,
              // so we link to the flat /compare/<slug> → auto-redirect is
              // a later optimization. For now, link to the category hub
              // with a deep-link anchor.
              return (
                <Card
                  key={med.id}
                  className="h-full transition-colors hover:bg-accent"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        {med.name}
                      </CardTitle>
                      {med.comparison_score !== null && (
                        <Badge className="shrink-0 bg-primary text-primary-foreground">
                          {med.comparison_score}
                        </Badge>
                      )}
                    </div>
                    {med.generic_name && (
                      <p className="text-xs text-muted-foreground">
                        {med.generic_name}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0 text-sm">
                    {med.verdict && (
                      <p className="line-clamp-3 italic text-muted-foreground">
                        &ldquo;{med.verdict}&rdquo;
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

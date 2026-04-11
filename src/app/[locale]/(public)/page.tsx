import { Search, ShieldCheck, BookOpen, Calendar, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublishedArticles } from "@/lib/actions/articles";
import { getCategories } from "@/lib/actions/categories";
import { ProductLookup } from "@/components/home/product-lookup";

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
};

export default async function Home() {
  const [articles, categories] = await Promise.all([
    getPublishedArticles(),
    getCategories(),
  ]);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background pt-5 pb-0">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Trusted OTC Medication
              <br />
              <span className="text-primary">Recommendations</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Expert pharmacist-reviewed guides to help you choose the right
              over-the-counter medications. Evidence-based, unbiased, and always
              up to date.
            </p>
          </div>
        </div>
      </section>

      {/* Product Lookup — the "wow moment" entry point */}
      <section className="pt-8 pb-4">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <ProductLookup />
        </div>
      </section>

      {/* Latest Articles */}
      {articles.length > 0 && (
        <section className="pt-5 pb-0">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold">Latest Articles</h2>
            <p className="mt-2 text-muted-foreground">
              Fresh pharmacist-reviewed medication guides
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.slice(0, 3).map((article) => (
                <Link key={article.id} href={`/${article.slug}`}>
                  <Card className="h-full transition-colors hover:bg-accent">
                    <CardHeader>
                      {article.category && (
                        <span className="text-xs font-medium text-primary">
                          {(article.category as any).name ?? (article.category as any)[0]?.name}
                        </span>
                      )}
                      <CardTitle className="text-lg leading-snug">
                        {article.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {article.excerpt}
                      </p>
                      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                        {article.published_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(article.published_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </span>
                        )}
                        {article.reading_time_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {article.reading_time_minutes} min read
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            {articles.length > 3 && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" render={<Link href="/guides" />}>
                  More Articles
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="mt-5 border-t bg-muted/30 pt-5 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold">
            Browse by Category
          </h2>
          <p className="mt-2 text-center text-muted-foreground">
            Find the right medication for your needs
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
              >
                <div className="flex items-center gap-3 rounded-lg border bg-background p-4 transition-colors hover:bg-accent">
                  <span className="text-2xl">
                    {categoryEmojis[category.slug] ?? "💊"}
                  </span>
                  <span className="font-medium">{category.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-lg bg-primary/10 p-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Dr.pharmacist Verified</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Every article is reviewed and approved by a licensed pharmacist
                with real clinical experience.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-lg bg-primary/10 p-3">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Evidence-Based</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Recommendations backed by FDA guidelines, clinical studies, and
                professional expertise.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-lg bg-primary/10 p-3">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Easy to Understand</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Complex medication information simplified into clear, actionable
                advice for everyday decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

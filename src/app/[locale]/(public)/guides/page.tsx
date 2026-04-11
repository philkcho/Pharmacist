import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPublishedArticles } from "@/lib/actions/articles";
import { getCategories } from "@/lib/actions/categories";
import { CategoryFilter } from "./category-filter";

interface GuidesPageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function GuidesPage({ searchParams }: GuidesPageProps) {
  const { category: selectedCategory = "" } = await searchParams;

  const [articles, categories] = await Promise.all([
    getPublishedArticles(),
    getCategories(),
  ]);

  const filteredArticles = selectedCategory
    ? articles.filter((article) => {
        const cat = article.category as
          | { slug?: string }
          | { slug?: string }[]
          | null;
        if (!cat) return false;
        if (Array.isArray(cat)) return cat[0]?.slug === selectedCategory;
        return cat.slug === selectedCategory;
      })
    : articles;

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

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Guides</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Browse every pharmacist-reviewed medication guide
          </p>
        </div>
        <CategoryFilter
          categories={categories}
          selected={selectedCategory}
        />
      </div>

      {filteredArticles.length === 0 ? (
        <p className="text-muted-foreground">
          {selectedCategory
            ? "No articles in this category yet."
            : "No articles published yet. Check back soon!"}
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {filteredArticles.map((article) => (
            <Link key={article.id} href={`/${article.slug}`}>
              <Card className="h-full transition-colors hover:bg-accent">
                <CardHeader>
                  {article.category && (
                    <span className="text-xs font-medium text-primary">
                      {(article.category as any).name ??
                        (article.category as any)[0]?.name}
                    </span>
                  )}
                  <CardTitle className="text-xl leading-snug">
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
                          { month: "short", day: "numeric", year: "numeric" }
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
      )}
    </div>
  );
}

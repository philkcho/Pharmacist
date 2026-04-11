import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getArticlesByCategory } from "@/lib/actions/articles";
import { notFound } from "next/navigation";

interface CategoryPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const { category, articles } = await getArticlesByCategory(slug);

  if (!category) notFound();

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

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
        {category.description && (
          <p className="mt-2 text-lg text-muted-foreground">
            {category.description}
          </p>
        )}
      </div>

      {articles.length === 0 ? (
        <p className="text-muted-foreground">
          No articles in this category yet. Check back soon!
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {articles.map((article) => (
            <Link key={article.id} href={`/${article.slug}`}>
              <Card className="h-full transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle className="text-xl">{article.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
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

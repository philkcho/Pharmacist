import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Calendar,
  Clock,
  ArrowLeft,
  ExternalLink,
  Check,
  X,
  Star,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getArticleBySlug } from "@/lib/actions/articles";
import { notFound } from "next/navigation";

interface ArticleReference {
  url: string;
  title: string;
  sourceType: "pubmed" | "fda" | "cdc" | "who" | "other";
}

interface ProductCard {
  name: string;
  genericName: string;
  pros: string[];
  cons: string[];
  verdict: string;
  recommended: boolean;
}

const sourceTypeLabels: Record<ArticleReference["sourceType"], string> = {
  pubmed: "PubMed",
  fda: "FDA",
  cdc: "CDC",
  who: "WHO",
  other: "Source",
};

interface ArticlePageProps {
  params: Promise<{ "article-slug": string; locale: string }>;
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { "article-slug": articleSlug } = await params;
  const article = await getArticleBySlug(articleSlug);

  if (!article) notFound();

  const references: ArticleReference[] = Array.isArray(article.article_references)
    ? (article.article_references as ArticleReference[])
    : [];
  const productCards: ProductCard[] = Array.isArray(article.product_cards)
    ? (article.product_cards as ProductCard[])
    : [];

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/" />}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Home
      </Button>

      {article.category && (
        <Badge variant="secondary" className="mb-4">
          {article.category.name}
        </Badge>
      )}

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {article.title}
      </h1>

      {article.excerpt && (
        <p className="mt-4 text-lg text-muted-foreground">{article.excerpt}</p>
      )}

      <div className="mt-6 flex items-center gap-4 border-b pb-6">
        <Avatar>
          <AvatarFallback>
            {article.author?.display_name
              ?.split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2) ?? "Ph"}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{article.author?.display_name}</p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {article.published_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(article.published_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            )}
            {article.reading_time_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {article.reading_time_minutes} min read
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className="prose prose-neutral mt-8 max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(article.content) }}
      />

      {productCards.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Recommended Products
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {productCards.map((product, i) => (
              <div
                key={i}
                className="rounded-lg border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold leading-tight">
                      {product.name}
                    </h3>
                    {product.genericName && (
                      <p className="text-sm text-muted-foreground">
                        {product.genericName}
                      </p>
                    )}
                  </div>
                  {product.recommended && (
                    <Badge className="shrink-0 gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Top Pick
                    </Badge>
                  )}
                </div>

                {product.verdict && (
                  <p className="mt-3 text-sm italic text-muted-foreground">
                    “{product.verdict}”
                  </p>
                )}

                {product.pros?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
                      Pros
                    </p>
                    <ul className="mt-1 space-y-1">
                      {product.pros.map((pro, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-1.5 text-sm"
                        >
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {product.cons?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
                      Cons
                    </p>
                    <ul className="mt-1 space-y-1">
                      {product.cons.map((con, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-1.5 text-sm"
                        >
                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                          <span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {references.length > 0 && (
        <section className="mt-12 border-t pt-8">
          <h2 className="text-2xl font-bold tracking-tight">References</h2>
          <ol className="mt-4 space-y-3">
            {references.map((ref, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 shrink-0 text-muted-foreground">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1 font-medium text-primary hover:underline"
                  >
                    <span>{ref.title}</span>
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                  </a>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {sourceTypeLabels[ref.sourceType] ?? "Source"}
                    </Badge>
                    <span className="truncate text-xs text-muted-foreground">
                      {ref.url}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

    </article>
  );
}

function markdownToHtml(markdown: string): string {
  if (!markdown) return "";

  let html = markdown
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  html = `<p>${html}</p>`;
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, "<ul>$&</ul>");
  return html;
}

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Shield,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  XCircle,
  Pill,
} from "lucide-react";
import { ReferencesSection } from "@/components/seo/references-section";
import { getOrGenerateSafetyArticle } from "@/lib/actions/safety-articles";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/ui/product-image";
import {
  BreadcrumbListJsonLd,
  ArticleJsonLd,
  MedicalWebPageJsonLd,
} from "@/components/seo/json-ld";
import { ReviewerByline } from "@/components/ui/reviewer-byline";
import { GlobalCtaBar } from "@/components/share/global-cta-bar";
import { SITE_AUTHOR } from "@/lib/author";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getOrGenerateSafetyArticle(slug);
  if (!data) return { title: "Not found — AI PharmCare" };

  const title = `Is ${data.product.name} Safe? — Pharmacist Review`;
  const description = data.article.hookAnswer.slice(0, 160);
  const url = `${SITE_URL}/is-safe/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "AI PharmCare",
      locale: "en_US",
      images: data.product.imageUrl
        ? [{ url: data.product.imageUrl, alt: data.product.name }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `Is ${data.product.name} Safe?`,
      description,
    },
  };
}

export default async function IsSafePage({ params }: Props) {
  const { slug } = await params;
  const data = await getOrGenerateSafetyArticle(slug);
  if (!data) notFound();

  const { product, article } = data;
  const url = `${SITE_URL}/is-safe/${slug}`;

  // Hook tone: look for Yes/No/Generally/Depends to pick an accent
  const firstWord = article.hookAnswer.trim().split(/\s+/)[0].toLowerCase();
  const hookAccent =
    firstWord.startsWith("yes") || firstWord.startsWith("generally")
      ? "text-green-700"
      : firstWord.startsWith("no")
        ? "text-red-700"
        : "text-amber-700";

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <ArticleJsonLd
        title={`Is ${product.name} Safe? — Pharmacist Review`}
        description={article.hookAnswer.slice(0, 200)}
        url={url}
        datePublished={data.generatedAt}
        dateModified={data.generatedAt}
        imageUrl={product.imageUrl}
      />
      <MedicalWebPageJsonLd
        name={`Is ${product.name} Safe?`}
        description={article.hookAnswer}
        url={url}
        lastReviewed={data.generatedAt}
        about={product.genericName ?? product.name}
      />
      <BreadcrumbListJsonLd
        items={[
          { name: "Home", url: `${SITE_URL}/` },
          {
            name: "Product Analysis",
            url: `${SITE_URL}/analysis/${product.slug}`,
          },
          { name: `Is ${product.name} Safe?`, url },
        ]}
      />

      {/* Header */}
      <header className="mb-6 flex items-start gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            iconSize={32}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Badge variant="outline" className="mb-2 gap-1 text-xs">
            <Shield className="h-3 w-3" />
            Pharmacist Safety Review
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Is {product.name} Safe?
          </h1>
          {product.genericName && (
            <p className="mt-1 text-sm text-muted-foreground">
              Generic: {product.genericName}
            </p>
          )}
        </div>
      </header>

      <ReviewerByline lastReviewedAt={data.generatedAt} className="mb-6" />

      {/* Hook Answer */}
      <section className="mb-8 rounded-lg border-l-4 border-primary bg-muted/30 p-5">
        <p className={`text-lg font-medium ${hookAccent}`}>
          {article.hookAnswer}
        </p>
      </section>

      {/* Who Should Avoid */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          Who Should Avoid or Consult First
        </h2>
        <ul className="space-y-2">
          {article.whoShouldAvoid.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Common Side Effects */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          <Pill className="h-5 w-5 text-amber-600" />
          Common Side Effects
        </h2>
        <ul className="space-y-2">
          {article.commonSideEffects.map((effect, i) => (
            <li
              key={i}
              className="rounded-md border bg-amber-50/30 px-3 py-2 text-sm"
            >
              {effect}
            </li>
          ))}
        </ul>
      </section>

      {/* Interactions */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Interactions to Watch For
        </h2>
        <div className="space-y-3">
          {article.interactions.map((int, i) => (
            <div key={i} className="rounded-md border p-3">
              <div className="font-semibold">{int.with}</div>
              <p className="mt-1 text-sm text-muted-foreground">{int.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          <HelpCircle className="h-5 w-5 text-primary" />
          People Also Ask
        </h2>
        <div className="space-y-4">
          {article.faq.map((item, i) => (
            <div key={i} className="rounded-lg border p-4">
              <h3 className="font-semibold">{item.question}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Line */}
      <section className="mb-8 rounded-lg bg-primary/5 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
          <Lightbulb className="h-5 w-5 text-primary" />
          Bottom Line
        </h2>
        <p className="text-base leading-relaxed">{article.bottomLine}</p>
      </section>

      <ReferencesSection references={article.references} />

      {/* Related: see full analysis */}
      <div className="mt-12 rounded-lg border-2 border-primary/20 p-5">
        <p className="text-sm text-muted-foreground">
          Want the full pharmacist analysis?
        </p>
        <Link
          href={`/analysis/${product.slug}`}
          className="mt-2 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          See full review of {product.name}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Disclosure */}
      <p className="mt-8 text-xs text-muted-foreground">
        Educational content based on FDA labeling, published research, and
        pharmacist review. Not a substitute for individualized medical advice.
      </p>

      {/* Sticky Share + Subscribe */}
      <GlobalCtaBar
        shareData={{
          productName: `Is ${product.name} safe?`,
          verdict: article.hookAnswer ?? null,
          score: null,
          productImageUrl: product.imageUrl ?? null,
          productType: "Safety review",
          url,
          reviewerName: SITE_AUTHOR.displayName,
        }}
      />
    </article>
  );
}

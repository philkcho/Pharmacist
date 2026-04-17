import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Beaker,
  Check,
  X,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  Package,
} from "lucide-react";
import { getOrGenerateIngredientGuide } from "@/lib/actions/ingredient-guides";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/ui/product-image";
import {
  BreadcrumbListJsonLd,
  ArticleJsonLd,
} from "@/components/seo/json-ld";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://drpharmacist.com";

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getOrGenerateIngredientGuide(slug);
  if (!data) return { title: "Ingredient not found — Dr.pharmacist" };

  const title = `${data.name} — What It Is, Benefits & Uses | Dr.pharmacist`;
  const description = data.article.hook.slice(0, 160);
  const url = `${SITE_URL}/ingredients/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `What is ${data.name}?`,
      description,
      url,
      type: "article",
      siteName: "Dr.pharmacist",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: `What is ${data.name}?`,
      description,
    },
  };
}

export default async function IngredientGuidePage({ params }: Props) {
  const { slug } = await params;
  const data = await getOrGenerateIngredientGuide(slug);
  if (!data) notFound();

  const { name, article, foundInProducts } = data;
  const url = `${SITE_URL}/ingredients/${slug}`;

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <ArticleJsonLd
        title={`What is ${name}? Benefits & Uses`}
        description={article.hook.slice(0, 200)}
        url={url}
        datePublished={data.generatedAt}
        dateModified={data.generatedAt}
      />
      <BreadcrumbListJsonLd
        items={[
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Ingredients", url: `${SITE_URL}/` },
          { name, url },
        ]}
      />

      {/* Header */}
      <header className="mb-6">
        <Badge variant="outline" className="mb-2 gap-1 text-xs">
          <Beaker className="h-3 w-3" />
          Ingredient Guide
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          What is {name}?
        </h1>
      </header>

      {/* Hook */}
      <section className="mb-8 rounded-lg border-l-4 border-primary bg-muted/30 p-5">
        <p className="text-lg font-medium">{article.hook}</p>
      </section>

      {/* What it is */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold">The Basics</h2>
        <p className="text-base leading-relaxed">{article.whatItIs}</p>
      </section>

      {/* Key benefits */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold">Key Benefits</h2>
        <div className="space-y-3">
          {article.keyBenefits.map((b, i) => (
            <div key={i} className="rounded-md border p-4">
              <h3 className="font-semibold">{b.benefit}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {b.explanation}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold">How It Works</h2>
        <p className="text-base leading-relaxed">{article.howItWorks}</p>
      </section>

      {/* Recommended concentration */}
      {article.recommendedConcentration && (
        <section className="mb-8 rounded-lg bg-primary/5 p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase text-primary">
            Effective Dose
          </h2>
          <p className="text-base">{article.recommendedConcentration}</p>
        </section>
      )}

      {/* Who should use / avoid */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-green-50/30 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-green-800">
            <Check className="h-4 w-4" />
            Who Benefits
          </h3>
          <ul className="space-y-1 text-sm">
            {article.whoShouldUse.map((who, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                {who}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border bg-red-50/30 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-red-800">
            <X className="h-4 w-4" />
            Who Should Avoid
          </h3>
          <ul className="space-y-1 text-sm">
            {article.whoShouldAvoid.map((who, i) => (
              <li key={i} className="flex items-start gap-2">
                <X className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />
                {who}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Side effects */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Common Side Effects
        </h2>
        <ul className="space-y-2">
          {article.sideEffects.map((effect, i) => (
            <li
              key={i}
              className="rounded-md border bg-amber-50/30 px-3 py-2 text-sm"
            >
              {effect}
            </li>
          ))}
        </ul>
      </section>

      {/* Compatibility */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold text-green-800">
            Works Well With
          </h3>
          <ul className="space-y-1 text-sm">
            {article.worksWellWith.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-red-800">
            Avoid Combining With
          </h3>
          <ul className="space-y-1 text-sm">
            {article.avoidCombiningWith.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <X className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />
                {c}
              </li>
            ))}
          </ul>
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
              <p className="mt-2 text-sm text-muted-foreground">
                {item.answer}
              </p>
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

      {/* Products containing this ingredient */}
      {foundInProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
            <Package className="h-5 w-5 text-primary" />
            Products Containing {name}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {foundInProducts.slice(0, 6).map((p) => (
              <Link
                key={p.slug}
                href={`/analysis/${p.slug}`}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border">
                  <ProductImage
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    iconSize={20}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {p.productType.replace("_", " ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Disclosure */}
      <p className="mt-8 text-xs text-muted-foreground">
        Evidence-based ingredient information. Not a substitute for
        individualized medical advice.
      </p>
    </article>
  );
}

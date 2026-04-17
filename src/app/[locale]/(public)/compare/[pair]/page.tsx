import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Scale,
  Check,
  X,
  Trophy,
  Lightbulb,
  ArrowRight,
  Minus,
} from "lucide-react";
import { getOrGenerateComparison } from "@/lib/actions/comparisons";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/ui/product-image";
import {
  BreadcrumbListJsonLd,
  ArticleJsonLd,
} from "@/components/seo/json-ld";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://drpharmacist.com";

interface Props {
  params: Promise<{ pair: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair } = await params;
  const result = await getOrGenerateComparison(pair);

  if (result.kind !== "ok") {
    return { title: "Comparison not found — Dr.pharmacist" };
  }

  const { productA, productB, article } = result.data;
  const title = `${productA.name} vs ${productB.name} — Which Is Better? Pharmacist Review`;
  const description = article.hook.slice(0, 160);
  const url = `${SITE_URL}/en/compare/${result.data.canonicalPairSlug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${productA.name} vs ${productB.name}`,
      description,
      url,
      type: "article",
      siteName: "Dr.pharmacist",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: `${productA.name} vs ${productB.name}`,
      description,
    },
  };
}

export default async function ComparePage({ params }: Props) {
  const { pair } = await params;
  const result = await getOrGenerateComparison(pair);

  if (result.kind === "redirect") redirect(result.to);
  if (result.kind === "not_found") notFound();

  const { productA, productB, article } = result.data;
  const url = `${SITE_URL}/en/compare/${result.data.canonicalPairSlug}`;

  return (
    <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <ArticleJsonLd
        title={`${productA.name} vs ${productB.name}`}
        description={article.hook.slice(0, 200)}
        url={url}
        datePublished={result.data.generatedAt}
        dateModified={result.data.generatedAt}
      />
      <BreadcrumbListJsonLd
        items={[
          { name: "Home", url: `${SITE_URL}/en` },
          { name: "Comparisons", url: `${SITE_URL}/en` },
          { name: `${productA.name} vs ${productB.name}`, url },
        ]}
      />

      {/* Header */}
      <header className="mb-6">
        <Badge variant="outline" className="mb-2 gap-1 text-xs">
          <Scale className="h-3 w-3" />
          Head-to-Head Comparison
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {productA.name} <span className="text-muted-foreground">vs</span>{" "}
          {productB.name}
        </h1>
      </header>

      {/* Product cards side-by-side */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <ProductCard product={productA} label="A" />
        <ProductCard product={productB} label="B" />
      </div>

      {/* Hook */}
      <section className="mb-8 rounded-lg border-l-4 border-primary bg-muted/30 p-5">
        <p className="text-lg font-medium">{article.hook}</p>
      </section>

      {/* Quick Verdict Table */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          <Trophy className="h-5 w-5 text-amber-500" />
          Winner by Use Case
        </h2>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Use Case</th>
                <th className="px-4 py-2 text-left font-medium">Winner</th>
                <th className="px-4 py-2 text-left font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {article.quickVerdict.winnerByUse.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-3 font-medium">{row.useCase}</td>
                  <td className="px-4 py-3">
                    <WinnerBadge
                      winner={row.winner}
                      productA={productA.name}
                      productB={productB.name}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Side-by-side */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold">Side-by-Side Comparison</h2>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Dimension</th>
                <th className="px-4 py-2 text-left font-medium">
                  {productA.name}
                </th>
                <th className="px-4 py-2 text-left font-medium">
                  {productB.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {article.sideBySide.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-3 font-semibold">{row.dimension}</td>
                  <td className="px-4 py-3">{row.productA}</td>
                  <td className="px-4 py-3">{row.productB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pros & Cons */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <ProsConsCard
          name={productA.name}
          pros={article.prosCons.productAPros}
          cons={article.prosCons.productACons}
        />
        <ProsConsCard
          name={productB.name}
          pros={article.prosCons.productBPros}
          cons={article.prosCons.productBCons}
        />
      </section>

      {/* Bottom Line */}
      <section className="mb-8 rounded-lg bg-primary/5 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
          <Lightbulb className="h-5 w-5 text-primary" />
          Bottom Line
        </h2>
        <p className="text-base leading-relaxed">{article.bottomLine}</p>
      </section>

      {/* CTA */}
      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        <Link
          href={`/analysis/${productA.slug}`}
          className="flex items-center justify-between rounded-lg border-2 border-primary/20 p-4 transition-colors hover:border-primary/40"
        >
          <div>
            <p className="text-xs text-muted-foreground">Full analysis</p>
            <p className="font-semibold">{productA.name}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-primary" />
        </Link>
        <Link
          href={`/analysis/${productB.slug}`}
          className="flex items-center justify-between rounded-lg border-2 border-primary/20 p-4 transition-colors hover:border-primary/40"
        >
          <div>
            <p className="text-xs text-muted-foreground">Full analysis</p>
            <p className="font-semibold">{productB.name}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-primary" />
        </Link>
      </div>
    </article>
  );
}

// ── Sub-components ──────────────────────────────────────────

function ProductCard({
  product,
  label,
}: {
  product: {
    name: string;
    slug: string;
    imageUrl: string | null;
    productType: string;
    priceRange?: string | null;
  };
  label: "A" | "B";
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {label}
      </div>
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover"
          iconSize={28}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="truncate font-semibold">{product.name}</h3>
        <p className="text-xs text-muted-foreground">
          {product.productType.replace("_", " ")}
        </p>
        {product.priceRange && (
          <p className="text-xs font-medium text-primary">
            {product.priceRange}
          </p>
        )}
      </div>
    </div>
  );
}

function WinnerBadge({
  winner,
  productA,
  productB,
}: {
  winner: "A" | "B" | "Tie";
  productA: string;
  productB: string;
}) {
  if (winner === "Tie") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
        <Minus className="h-3 w-3" /> Tie
      </span>
    );
  }
  const name = winner === "A" ? productA : productB;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
      <Trophy className="h-3 w-3" /> {name}
    </span>
  );
}

function ProsConsCard({
  name,
  pros,
  cons,
}: {
  name: string;
  pros: string[];
  cons: string[];
}) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 font-bold">{name}</h3>
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-green-700">
            Pros
          </p>
          <ul className="space-y-1 text-sm">
            {pros.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-red-700">
            Cons
          </p>
          <ul className="space-y-1 text-sm">
            {cons.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

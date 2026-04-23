import Link from "next/link";
import {
  Scale,
  FlaskConical,
  Target,
  DollarSign,
  Check,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import type { ExpertComparison } from "@/lib/ai/generate-expert-comparison";
import type { ComparisonProductCard } from "@/lib/actions/expert-picks";

interface Props {
  products: ComparisonProductCard[];
  comparison: ExpertComparison;
}

/**
 * Inline "Products at a Glance" section on /expert/[slug] pages.
 * Renders a thumbnail row + three subsections (Ingredients, Efficacy,
 * Value) + an overall takeaway. Tables/lists come from DB data; the
 * pharmacist notes and verdicts are AI-generated (cached in
 * expert_picks.comparison_jsonb).
 */
export function ProductsAtAGlance({ products, comparison }: Props) {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const valuePickProduct = bySlug.get(comparison.valuePick.slug);
  const distinctiveEntries = Object.entries(
    comparison.ingredientSummary.distinctive
  ).filter(([, items]) => items.length > 0);

  return (
    <div>
      {/* Section header */}
      <div className="mb-5">
        <div className="mb-3 h-0.5 w-10 bg-primary" />
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Scale className="h-5 w-5 text-primary" />
          Products at a Glance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quick comparison across the products mentioned above
        </p>
      </div>

      {/* Thumbnail row */}
      <div
        className={`mb-8 grid gap-3 ${gridColsForCount(products.length)}`}
      >
        {products.map((p) => (
          <Link
            key={p.slug}
            href={`/analysis/${p.slug}`}
            className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-background">
              <ProductImage
                src={p.imageUrl}
                alt={p.name}
                className="h-full w-full object-contain"
                iconSize={28}
              />
            </div>
            <p className="line-clamp-2 text-center text-xs font-semibold leading-tight group-hover:text-primary">
              {p.name}
            </p>
          </Link>
        ))}
      </div>

      {/* Ingredients */}
      <Subsection
        icon={FlaskConical}
        title="Ingredients"
        description="Top actives per product + what overlaps"
      >
        <div
          className={`grid gap-3 ${gridColsForCount(products.length)}`}
        >
          {products.map((p) => (
            <div
              key={p.slug}
              className="rounded-lg border bg-card p-3"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {p.name}
              </p>
              {p.ingredients.length > 0 ? (
                <ul className="space-y-1.5">
                  {p.ingredients.slice(0, 3).map((ing, i) => (
                    <li key={i} className="text-sm leading-snug">
                      <span className="font-medium">{ing.name}</span>
                      {ing.purpose && (
                        <span className="block text-xs text-muted-foreground">
                          {ing.purpose}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Active ingredients not listed.
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Pharmacist's take */}
        <div className="mt-4 rounded-lg border-l-4 border-primary bg-muted/30 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
            Pharmacist&apos;s take
          </p>
          <p className="text-sm leading-relaxed">
            {comparison.ingredientSummary.pharmacistNote}
          </p>

          {(comparison.ingredientSummary.shared.length > 0 ||
            distinctiveEntries.length > 0) && (
            <div className="mt-3 space-y-2">
              {comparison.ingredientSummary.shared.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Shared:
                  </span>
                  {comparison.ingredientSummary.shared.map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {distinctiveEntries.map(([slug, items]) => {
                const product = bySlug.get(slug);
                if (!product) return null;
                return (
                  <div
                    key={slug}
                    className="flex flex-wrap items-center gap-1.5"
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      Only in {product.name}:
                    </span>
                    {items.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border bg-background px-2 py-0.5 text-xs"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Subsection>

      {/* Efficacy */}
      <Subsection
        icon={Target}
        title="Best For / Avoid If"
        description="When each product shines — and when another wins"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
          {comparison.efficacyVerdicts.map((v) => {
            const product = bySlug.get(v.slug);
            if (!product) return null;
            return (
              <div
                key={v.slug}
                className="rounded-lg border bg-card p-4"
              >
                <p className="mb-3 font-semibold leading-snug">
                  {product.name}
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="text-sm leading-snug">
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        Best for:
                      </span>{" "}
                      {v.bestFor}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="text-sm leading-snug">
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        Avoid if:
                      </span>{" "}
                      {v.avoidIf}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Subsection>

      {/* Value */}
      <Subsection
        icon={DollarSign}
        title="Price & Value"
        description="Who delivers the best ratio"
      >
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Product</th>
                <th className="px-4 py-2 text-left font-medium">Price range</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const isValuePick = p.slug === comparison.valuePick.slug;
                return (
                  <tr
                    key={p.slug}
                    className={`border-t ${isValuePick ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/analysis/${p.slug}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                      {isValuePick && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                          <Trophy className="h-3 w-3" />
                          Best value
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.priceRange ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {valuePickProduct && (
          <div className="mt-4 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Trophy className="h-3.5 w-3.5" />
              Best value: {valuePickProduct.name}
            </p>
            <p className="text-sm leading-relaxed">
              {comparison.valuePick.reason}
            </p>
          </div>
        )}
      </Subsection>

      {/* Overall takeaway */}
      <div className="mt-8 rounded-xl border bg-muted/20 p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          How to choose
        </p>
        <p className="text-base leading-relaxed">
          {comparison.overallTakeaway}
        </p>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────

function gridColsForCount(n: number): string {
  // Tailwind needs complete class literals, so enumerate explicitly.
  if (n <= 2) return "grid-cols-2";
  if (n === 3) return "grid-cols-2 sm:grid-cols-3";
  if (n === 4) return "grid-cols-2 sm:grid-cols-4";
  return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
}

function Subsection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof FlaskConical;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { LayoutGrid, ArrowRight } from "lucide-react";
import { listWidgetCategories } from "@/lib/actions/categories";
import { Badge } from "@/components/ui/badge";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

export const metadata: Metadata = {
  title: "Browse Categories — AI PharmCare",
  description:
    "Browse pharmacist-reviewed health and beauty products by category — pain relief, allergy, sleep, K-beauty, and more. Each category links to top products and trends.",
  alternates: { canonical: `${SITE_URL}/explore` },
  openGraph: {
    title: "All Categories — AI PharmCare",
    description: "Pharmacist-reviewed products organized by category.",
    url: `${SITE_URL}/explore`,
    type: "website",
  },
};

const DOMAIN_LABEL: Record<string, string> = {
  pharmaceutical: "Pharmaceutical",
  beauty: "Beauty",
};

export default async function CategoriesPage() {
  const categories = await listWidgetCategories();

  // Group by domain for visual sections.
  const byDomain = new Map<string, typeof categories>();
  for (const c of categories) {
    const list = byDomain.get(c.domain) ?? [];
    list.push(c);
    byDomain.set(c.domain, list);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <LayoutGrid className="h-7 w-7 text-primary" />
          Browse Categories
        </h1>
        <p className="mt-2 text-muted-foreground">
          Pharmacist-reviewed health & beauty products organized by category.
          Tap any category to see top picks and related trends.
        </p>
      </header>

      {categories.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>No categories with approved products yet.</p>
          <p className="mt-1 text-sm">
            Check back soon — new categories are added regularly.
          </p>
        </div>
      ) : (
        Array.from(byDomain.entries()).map(([domain, list]) => (
          <section key={domain} className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {DOMAIN_LABEL[domain] ?? domain}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/topics/${cat.slug}`}
                  className="group flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold group-hover:text-primary">
                      {cat.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cat.productCount}{" "}
                      {cat.productCount === 1 ? "product" : "products"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {cat.productCount}
                  </Badge>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

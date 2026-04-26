"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Search, ShoppingCart, Loader2, FlaskConical, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { ProductImage } from "@/components/ui/product-image";
import type {
  CategoryDomain,
  CategoryWidgetEntry,
} from "@/lib/actions/categories";
import type { CategoryTopProduct } from "@/lib/actions/medications";
import { getCategoryTopProducts } from "@/lib/actions/medications";

interface Props {
  categories: CategoryWidgetEntry[];
  initialSlug: string;
  initialProducts: CategoryTopProduct[];
}

const DOMAIN_LABELS: Record<CategoryDomain, string> = {
  pharmaceutical: "Pharmaceutical",
  beauty: "Beauty",
};

/**
 * Client-side interactive homepage widget:
 *   - searchable + scrollable ingredient-level category list
 *   - top-5 approved products for the selected category
 *   - Buy buttons link directly to the highest-priority retailer purchase link
 *
 * Rendered only on the homepage (parent wrapper gates on pathname).
 */
export function CategoryWidget({
  categories,
  initialSlug,
  initialProducts,
}: Props) {
  // Pick the initial domain from whichever domain the initialSlug belongs to.
  const initialCat = categories.find((c) => c.slug === initialSlug);
  const [domain, setDomain] = useState<CategoryDomain>(
    initialCat?.domain ?? "pharmaceutical"
  );
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const [products, setProducts] =
    useState<CategoryTopProduct[]>(initialProducts);
  const [isPending, startTransition] = useTransition();

  // Categories for the currently selected domain
  const domainCategories = useMemo(
    () => categories.filter((c) => c.domain === domain),
    [categories, domain]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return domainCategories;
    const q = query.trim().toLowerCase();
    return domainCategories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.includes(q)
    );
  }, [domainCategories, query]);

  const selected =
    domainCategories.find((c) => c.slug === selectedSlug) ??
    domainCategories[0];

  const handleSelect = (slug: string) => {
    if (slug === selectedSlug) return;
    setSelectedSlug(slug);
    startTransition(async () => {
      const next = await getCategoryTopProducts(slug, 5);
      setProducts(next);
    });
  };

  const handleDomainChange = (next: CategoryDomain) => {
    if (next === domain) return;
    setDomain(next);
    setQuery("");
    const nextDomainCategories = categories.filter((c) => c.domain === next);
    const firstSlug = nextDomainCategories[0]?.slug;
    if (!firstSlug) return;
    setSelectedSlug(firstSlug);
    startTransition(async () => {
      const nextProducts = await getCategoryTopProducts(firstSlug, 5);
      setProducts(nextProducts);
    });
  };

  if (categories.length === 0) return null;

  // Presence of each domain's categories (for disabling empty toggle)
  const hasPharma = categories.some((c) => c.domain === "pharmaceutical");
  const hasBeauty = categories.some((c) => c.domain === "beauty");

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Popular Categories</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Pick a category to see the top picks
      </p>

      {/* Domain toggle — Pharmaceutical / Beauty */}
      <div
        role="radiogroup"
        aria-label="Category domain"
        className="mt-3 flex rounded-lg border bg-muted/40 p-0.5"
      >
        <DomainToggleButton
          icon={FlaskConical}
          label={DOMAIN_LABELS.pharmaceutical}
          selected={domain === "pharmaceutical"}
          disabled={!hasPharma}
          onClick={() => handleDomainChange("pharmaceutical")}
        />
        <DomainToggleButton
          icon={Sparkles}
          label={DOMAIN_LABELS.beauty}
          selected={domain === "beauty"}
          disabled={!hasBeauty}
          onClick={() => handleDomainChange("beauty")}
        />
      </div>

      {/* Search */}
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories…"
          className="w-full rounded-lg border bg-background py-1.5 pl-8 pr-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Search categories"
        />
      </div>

      {/* Scrollable category list */}
      <ul
        role="listbox"
        aria-label={`${DOMAIN_LABELS[domain]} categories`}
        className="mt-2 max-h-[240px] space-y-0.5 overflow-y-auto pr-1"
      >
        {filtered.length === 0 && (
          <li className="px-2 py-3 text-center text-xs text-muted-foreground">
            No matches
          </li>
        )}
        {filtered.map((c) => {
          const isSelected = c.slug === selectedSlug;
          return (
            <li key={c.slug}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(c.slug)}
                className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5 font-semibold text-primary"
                    : "border-transparent hover:border-primary/20 hover:bg-muted/50"
                }`}
              >
                <span className="truncate">{c.name}</span>
                <span
                  className={`shrink-0 text-[10px] ${
                    isSelected ? "text-primary/80" : "text-muted-foreground"
                  }`}
                >
                  {c.productCount.toLocaleString()}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Divider */}
      <div className="my-4 border-t" />

      {/* Top picks */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Top picks in {selected?.name ?? ""}
        </h3>
        {isPending && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {products.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
          No products yet in this category.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {products.map((p, i) => (
            <ProductRow
              key={p.id}
              product={p}
              rank={i + 1}
              priority={i === 0}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function DomainToggleButton({
  icon: Icon,
  label,
  selected,
  disabled,
  onClick,
}: {
  icon: typeof FlaskConical;
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-all ${
        selected
          ? "bg-background text-primary shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ProductRow({
  product,
  rank,
  priority = false,
}: {
  product: CategoryTopProduct;
  rank: number;
  priority?: boolean;
}) {
  const buyHref = product.purchaseUrl ?? `/analysis/${product.slug}`;
  const buyIsExternal = !!product.purchaseUrl;

  return (
    <li className="group flex items-start gap-2 rounded-lg border bg-background p-2 transition-colors hover:border-primary/30">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
        {rank}
      </span>
      <Link
        href={`/analysis/${product.slug}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background"
        aria-label={`View ${product.name} analysis`}
      >
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-contain"
          iconSize={20}
          priority={priority}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/analysis/${product.slug}`}
          className="line-clamp-2 text-xs font-medium leading-snug hover:text-primary"
        >
          {product.name}
        </Link>
        <div className="mt-0.5 flex items-center justify-between gap-1">
          <span className="truncate text-[11px] text-muted-foreground">
            {product.priceRange ?? ""}
          </span>
          <BuyButton
            href={buyHref}
            external={buyIsExternal}
            retailer={product.retailerName}
          />
        </div>
      </div>
    </li>
  );
}

function BuyButton({
  href,
  external,
  retailer,
}: {
  href: string;
  external: boolean;
  retailer: string | null;
}) {
  const label = external
    ? retailer
      ? `Buy · ${retailer}`
      : "Buy"
    : "View";
  return external ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <ShoppingCart className="h-2.5 w-2.5" />
      {label}
    </a>
  ) : (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[10px] font-medium transition-colors hover:border-primary/40 hover:text-primary"
    >
      {label}
    </Link>
  );
}

// ─── Sticky desktop wrapper ─────────────────────────────────

/**
 * Homepage-only sticky left sidebar wrapper for <CategoryWidget>.
 * Mirrors <ConsultSidebar>'s pathname check and sticky sizing.
 */
export function CategoryWidgetSidebar({
  categories,
  initialSlug,
  initialProducts,
}: Props) {
  const pathname = usePathname();
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  const isHome = pathWithoutLocale === "" || pathWithoutLocale === "/";
  if (!isHome) return null;

  if (categories.length === 0) return null;

  return (
    <aside className="sticky top-[80px] hidden h-[calc(100vh-100px)] w-[340px] shrink-0 overflow-y-auto lg:block">
      <CategoryWidget
        categories={categories}
        initialSlug={initialSlug}
        initialProducts={initialProducts}
      />
    </aside>
  );
}

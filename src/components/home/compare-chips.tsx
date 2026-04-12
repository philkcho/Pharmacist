import Link from "next/link";
import { Scale } from "lucide-react";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface CompareChipsProps {
  categories: Category[];
  categoryEmojis: Record<string, string>;
}

/**
 * Mobile-only horizontal scroll chip list for Compare by Category.
 * Shown below the Product Lookup and above Latest Articles so users
 * on small screens get a quick jump into the compare flow without
 * losing the Lookup as their primary entry point.
 *
 * NOTE: Until Sprint 3 `/compare/[category-slug]` lands, chips link
 * to the existing `/categories/[slug]` article pages. Swap the href
 * template when the comparison view is built.
 */
export function CompareChips({
  categories,
  categoryEmojis,
}: CompareChipsProps) {
  if (categories.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Scale className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Compare by Category</h2>
      </div>

      {/* Horizontal scroll row — chip per category */}
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Compare by category"
      >
        {categories.map((category) => (
          <Link
            key={category.id}
            // TODO(sprint-3): swap to /compare/${category.slug}
            href={`/categories/${category.slug}`}
            className="flex shrink-0 snap-start items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <span className="text-base leading-none" aria-hidden>
              {categoryEmojis[category.slug] ?? "💊"}
            </span>
            <span className="whitespace-nowrap">{category.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

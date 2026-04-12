import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface CompareSidebarProps {
  categories: Category[];
  categoryEmojis: Record<string, string>;
}

/**
 * Left-column entry point on the home page. Presents each category as a
 * one-click jump into the product comparison view for that category.
 *
 * NOTE: Until the Sprint 3 `/compare/[category-slug]` pages land, these
 * links point to the existing `/categories/[slug]` page (pharmacist
 * articles for that category). When the full comparison table ships,
 * flip the `href` template below to `/compare/${slug}`.
 */
export function CompareSidebar({
  categories,
  categoryEmojis,
}: CompareSidebarProps) {
  if (categories.length === 0) return null;

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-primary" />
          Compare Products
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pick a category to see pharmacist-reviewed picks
        </p>
      </CardHeader>
      <CardContent className="space-y-1 pb-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            // TODO(sprint-3): swap to /compare/${category.slug}
            href={`/categories/${category.slug}`}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <span className="text-lg leading-none" aria-hidden>
              {categoryEmojis[category.slug] ?? "💊"}
            </span>
            <span className="flex-1 truncate font-medium">{category.name}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

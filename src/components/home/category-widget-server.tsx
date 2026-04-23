import { listWidgetCategories } from "@/lib/actions/categories";
import { getCategoryTopProducts } from "@/lib/actions/medications";
import { CategoryWidgetSidebar } from "./category-widget";

/**
 * Server-side data loader for the homepage category widget.
 * Fetches all widget categories (pharmaceutical + beauty) + first
 * pharmaceutical category's top-5 as the initial state. Client widget
 * handles the domain toggle.
 *
 * Renders nothing when no categories have approved products yet.
 */
export async function CategoryWidgetServer() {
  const categories = await listWidgetCategories();

  if (categories.length === 0) return null;

  // Default: first pharmaceutical category (falls back to any if none).
  const pharma = categories.find((c) => c.domain === "pharmaceutical");
  const initialSlug = (pharma ?? categories[0]).slug;
  const initialProducts = await getCategoryTopProducts(initialSlug, 5);

  return (
    <CategoryWidgetSidebar
      categories={categories}
      initialSlug={initialSlug}
      initialProducts={initialProducts}
    />
  );
}

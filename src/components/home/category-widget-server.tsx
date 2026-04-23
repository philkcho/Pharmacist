import { listSupplementChildCategories } from "@/lib/actions/categories";
import { getCategoryTopProducts } from "@/lib/actions/medications";
import { CategoryWidgetSidebar } from "./category-widget";

/**
 * Server-side data loader for the homepage category widget.
 * Fetches the category list + first category's top-5 in parallel,
 * then hands off to the client <CategoryWidgetSidebar>.
 *
 * Renders nothing when no categories have approved products yet.
 */
export async function CategoryWidgetServer() {
  const categories = await listSupplementChildCategories();

  if (categories.length === 0) return null;

  const initialSlug = categories[0].slug;
  const initialProducts = await getCategoryTopProducts(initialSlug, 5);

  return (
    <CategoryWidgetSidebar
      categories={categories}
      initialSlug={initialSlug}
      initialProducts={initialProducts}
    />
  );
}

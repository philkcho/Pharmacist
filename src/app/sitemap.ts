import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://drpharmacist.com";

// Regenerate sitemap hourly so newly generated SEO pages (safety articles,
// comparisons, ingredient guides) appear without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/trending`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/expert`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/search`, changeFrequency: "weekly", priority: 0.4 },
  ];

  // Published trend articles
  const { data: trends } = await admin
    .from("trend_topics")
    .select("slug, updated_at")
    .eq("status", "published")
    .not("slug", "is", null);

  const trendPages: MetadataRoute.Sitemap = (trends ?? []).map((t) => ({
    url: `${SITE_URL}/trending/${t.slug}`,
    lastModified: t.updated_at ?? undefined,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Published expert analyses
  const { data: experts } = await admin
    .from("expert_picks")
    .select("slug, updated_at")
    .eq("status", "published");

  const expertPages: MetadataRoute.Sitemap = (experts ?? []).map((e) => ({
    url: `${SITE_URL}/expert/${e.slug}`,
    lastModified: e.updated_at ?? undefined,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Approved product analyses
  const { data: products } = await admin
    .from("medications")
    .select("slug, updated_at")
    .eq("approval_status", "approved")
    .not("verdict", "is", null);

  const productPages: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
    url: `${SITE_URL}/analysis/${p.slug}`,
    lastModified: p.updated_at ?? undefined,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // "Is X Safe?" SEO pages — one per approved product.
  // These target long-tail safety queries (pregnancy, alcohol, interactions).
  const safetyPages: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
    url: `${SITE_URL}/is-safe/${p.slug}`,
    lastModified: p.updated_at ?? undefined,
    changeFrequency: "monthly" as const,
    priority: 0.7, // slightly higher — higher search intent
  }));

  // Cached product comparisons (generated on-demand, persisted)
  const { data: comparisons } = await admin
    .from("product_comparisons")
    .select("slug_a, slug_b, updated_at");

  const comparisonPages: MetadataRoute.Sitemap = (comparisons ?? []).map(
    (c) => ({
      url: `${SITE_URL}/vs/${c.slug_a}-vs-${c.slug_b}`,
      lastModified: c.updated_at ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })
  );

  // Cached ingredient guides
  const { data: ingredientRows } = await admin
    .from("ingredient_guides")
    .select("slug, updated_at");

  const ingredientPages: MetadataRoute.Sitemap = (ingredientRows ?? []).map(
    (i) => ({
      url: `${SITE_URL}/ingredients/${i.slug}`,
      lastModified: i.updated_at ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })
  );

  // Topic pages — driven by trend query_text values.
  // These are the keyword hubs (e.g. /topics/probiotics) that aggregate
  // retailer listings, products, and related trends.
  const { data: trendTopics } = await admin
    .from("trend_topics")
    .select("query_text, updated_at")
    .eq("status", "published");

  const uniqueTopics = new Set(
    (trendTopics ?? []).map((t) => (t.query_text as string).toLowerCase().trim())
  );
  const topicPages: MetadataRoute.Sitemap = Array.from(uniqueTopics).map(
    (keyword) => ({
      url: `${SITE_URL}/topics/${encodeURIComponent(keyword.replace(/\s+/g, "-"))}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })
  );

  return [
    ...staticPages,
    ...trendPages,
    ...expertPages,
    ...productPages,
    ...safetyPages,
    ...comparisonPages,
    ...ingredientPages,
    ...topicPages,
  ];
}

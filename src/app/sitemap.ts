import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://drpharmacist.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/en`, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/en/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/en/trending`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/en/expert`, changeFrequency: "weekly", priority: 0.8 },
  ];

  // Published trend articles
  const { data: trends } = await admin
    .from("trend_topics")
    .select("slug, updated_at")
    .eq("status", "published")
    .not("slug", "is", null);

  const trendPages: MetadataRoute.Sitemap = (trends ?? []).map((t) => ({
    url: `${SITE_URL}/en/trending/${t.slug}`,
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
    url: `${SITE_URL}/en/expert/${e.slug}`,
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
    url: `${SITE_URL}/en/analysis/${p.slug}`,
    lastModified: p.updated_at ?? undefined,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...trendPages, ...expertPages, ...productPages];
}

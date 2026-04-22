"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Where a product shows up as a "related product" on the public site. The three
// surfaces mirror the homepage sections.
export type RecommendationSurface = "expert" | "consult" | "trending";

export interface ProductRecommendationSource {
  surface: RecommendationSurface;
  pageTitle: string;
  pageSlug: string;
  /** Public URL path (for preview from the admin view). */
  pagePath: string;
  /** Reason copy when the surface provided one; else null. */
  reason: string | null;
}

export interface RecommendedProduct {
  productId: number | null;
  productSlug: string | null;
  productName: string;
  imageUrl: string | null;
  approvalStatus: string | null;
  sources: ProductRecommendationSource[];
}

export interface RecommendationSummary {
  /** Count of distinct products recommended across all surfaces. */
  uniqueProductCount: number;
  /** Counts per surface (each page with at least 1 recommendation). */
  bySurface: Record<RecommendationSurface, number>;
  /** Total recommendation placements (sum of sources across products). */
  totalPlacements: number;
}

interface RawEntry {
  surface: RecommendationSurface;
  productId: number | null;
  productSlug: string | null;
  productName: string;
  pageTitle: string;
  pageSlug: string;
  pagePath: string;
  reason: string | null;
}

// ──────────────────────────────────────────────────────────

async function collectRawEntries(): Promise<RawEntry[]> {
  const admin = createAdminClient();

  const [expertRes, consultsRes, trendsRes] = await Promise.all([
    // Dr.'s Analysis — mentioned_products JSONB: [{name, slug?, reason}]
    admin
      .from("expert_picks")
      .select("slug, title, mentioned_products")
      .eq("status", "published"),
    // Consult articles — related_product_ids bigint[] of medications.id
    admin
      .from("consults")
      .select("slug, redacted_input_jsonb, pharmacist_final_jsonb, related_product_ids")
      .eq("visibility", "public")
      .not("slug", "is", null),
    // Trending articles — trend_analyses.product_matches_jsonb: ProductMatch[]
    // Joined to trend_topics for the public slug/title.
    admin
      .from("trend_analyses")
      .select(
        "product_matches_jsonb, trend_topics!inner(slug, keyword, status)"
      )
      .eq("trend_topics.status", "published"),
  ]);

  const entries: RawEntry[] = [];

  // ── Dr.'s Analysis
  for (const row of (expertRes.data ?? []) as Array<{
    slug: string | null;
    title: string;
    mentioned_products:
      | { name: string; slug?: string | null; reason?: string | null }[]
      | null;
  }>) {
    if (!row.slug || !row.mentioned_products?.length) continue;
    for (const p of row.mentioned_products) {
      if (!p?.name) continue;
      entries.push({
        surface: "expert",
        productId: null,
        productSlug: p.slug ?? null,
        productName: p.name,
        pageTitle: row.title,
        pageSlug: row.slug,
        pagePath: `/expert/${row.slug}`,
        reason: p.reason ?? null,
      });
    }
  }

  // ── Consult articles
  for (const row of (consultsRes.data ?? []) as Array<{
    slug: string | null;
    redacted_input_jsonb: Record<string, unknown> | null;
    pharmacist_final_jsonb: Record<string, unknown> | null;
    related_product_ids: number[] | null;
  }>) {
    if (!row.slug || !row.related_product_ids?.length) continue;
    const title =
      (row.redacted_input_jsonb?.title as string | undefined) ??
      (row.pharmacist_final_jsonb?.title as string | undefined) ??
      `Consult ${row.slug}`;
    for (const id of row.related_product_ids) {
      entries.push({
        surface: "consult",
        productId: id,
        productSlug: null,
        productName: `#${id}`, // will be replaced by medication name lookup below
        pageTitle: title,
        pageSlug: row.slug,
        pagePath: `/consult/${row.slug}`,
        reason: null,
      });
    }
  }

  // ── Trending articles
  // Supabase typegen returns the joined `trend_topics` as an array even though
  // the `!inner` join is one-to-one. Normalize to the first (only) element.
  for (const row of (trendsRes.data ?? []) as unknown as Array<{
    product_matches_jsonb:
      | {
          medicationId?: number;
          name?: string;
          slug?: string;
          reason?: string;
        }[]
      | null;
    trend_topics:
      | { slug: string | null; keyword: string }
      | { slug: string | null; keyword: string }[];
  }>) {
    const topic = Array.isArray(row.trend_topics)
      ? row.trend_topics[0]
      : row.trend_topics;
    if (!topic?.slug || !row.product_matches_jsonb?.length) continue;
    for (const p of row.product_matches_jsonb) {
      if (!p?.name) continue;
      entries.push({
        surface: "trending",
        productId: p.medicationId ?? null,
        productSlug: p.slug ?? null,
        productName: p.name,
        pageTitle: topic.keyword,
        pageSlug: topic.slug,
        pagePath: `/trending/${topic.slug}`,
        reason: p.reason ?? null,
      });
    }
  }

  return entries;
}

async function enrichWithMedications(
  entries: RawEntry[]
): Promise<RawEntry[]> {
  const admin = createAdminClient();
  const needIds = [
    ...new Set(
      entries
        .filter((e) => e.productId != null && !e.productSlug)
        .map((e) => e.productId!)
    ),
  ];
  const needSlugs = [
    ...new Set(
      entries
        .filter((e) => e.productSlug && e.productId == null)
        .map((e) => e.productSlug!)
    ),
  ];

  const [byIdRes, bySlugRes] = await Promise.all([
    needIds.length > 0
      ? admin.from("medications").select("id, slug, name").in("id", needIds)
      : Promise.resolve({ data: [] as unknown[] }),
    needSlugs.length > 0
      ? admin.from("medications").select("id, slug, name").in("slug", needSlugs)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const byId = new Map<number, { slug: string; name: string }>();
  for (const m of (byIdRes.data ?? []) as Array<{
    id: number;
    slug: string;
    name: string;
  }>) {
    byId.set(m.id, { slug: m.slug, name: m.name });
  }
  const bySlug = new Map<string, { id: number; name: string }>();
  for (const m of (bySlugRes.data ?? []) as Array<{
    id: number;
    slug: string;
    name: string;
  }>) {
    bySlug.set(m.slug, { id: m.id, name: m.name });
  }

  return entries.map((e) => {
    if (e.productId != null && !e.productSlug) {
      const m = byId.get(e.productId);
      if (m)
        return {
          ...e,
          productSlug: m.slug,
          productName: e.productName.startsWith("#") ? m.name : e.productName,
        };
    }
    if (e.productSlug && e.productId == null) {
      const m = bySlug.get(e.productSlug);
      if (m) return { ...e, productId: m.id };
    }
    return e;
  });
}

function dedupeKey(e: RawEntry): string {
  // Prefer slug; fall back to id; fall back to normalized name. Different slugs
  // for the same name stay distinct (admin can clean those up separately).
  if (e.productSlug) return `slug:${e.productSlug}`;
  if (e.productId != null) return `id:${e.productId}`;
  return `name:${e.productName.trim().toLowerCase()}`;
}

// ── Public API ─────────────────────────────────────────────

export async function getRecommendationsSummary(): Promise<RecommendationSummary> {
  const entries = await collectRawEntries();
  const unique = new Set<string>();
  const bySurface: Record<RecommendationSurface, number> = {
    expert: 0,
    consult: 0,
    trending: 0,
  };
  for (const e of entries) {
    unique.add(dedupeKey(e));
    bySurface[e.surface] += 1;
  }
  return {
    uniqueProductCount: unique.size,
    bySurface,
    totalPlacements: entries.length,
  };
}

export async function getRecommendationsDetail(): Promise<
  RecommendedProduct[]
> {
  const raw = await collectRawEntries();
  const enriched = await enrichWithMedications(raw);

  // Look up image/approval for enrichable products in one shot.
  const admin = createAdminClient();
  const productIds = [
    ...new Set(
      enriched
        .map((e) => e.productId)
        .filter((id): id is number => id != null)
    ),
  ];
  const { data: mediaRows } =
    productIds.length > 0
      ? await admin
          .from("medications")
          .select("id, slug, name, image_url, approval_status")
          .in("id", productIds)
      : { data: [] as unknown[] };
  const mediaById = new Map<
    number,
    { slug: string; name: string; imageUrl: string | null; approval: string }
  >();
  for (const m of (mediaRows ?? []) as Array<{
    id: number;
    slug: string;
    name: string;
    image_url: string | null;
    approval_status: string;
  }>) {
    mediaById.set(m.id, {
      slug: m.slug,
      name: m.name,
      imageUrl: m.image_url,
      approval: m.approval_status,
    });
  }

  // Group by dedupe key
  const grouped = new Map<string, RecommendedProduct>();
  for (const e of enriched) {
    const key = dedupeKey(e);
    const media = e.productId != null ? mediaById.get(e.productId) : undefined;
    let group = grouped.get(key);
    if (!group) {
      group = {
        productId: e.productId ?? null,
        productSlug: media?.slug ?? e.productSlug ?? null,
        productName: media?.name ?? e.productName,
        imageUrl: media?.imageUrl ?? null,
        approvalStatus: media?.approval ?? null,
        sources: [],
      };
      grouped.set(key, group);
    }
    group.sources.push({
      surface: e.surface,
      pageTitle: e.pageTitle,
      pageSlug: e.pageSlug,
      pagePath: e.pagePath,
      reason: e.reason,
    });
  }

  return [...grouped.values()].sort(
    (a, b) =>
      b.sources.length - a.sources.length ||
      a.productName.localeCompare(b.productName)
  );
}

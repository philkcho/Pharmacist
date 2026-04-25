import { createAdminClient } from "@/lib/supabase/admin";

export interface DigestItem {
  url: string;
  kind: "trend" | "expert" | "analysis";
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  publishedAt: string | null;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

/**
 * Pick the freshest, highest-quality items for a subscriber that they
 * haven't received in the last 30 days. Returns up to `limit` items.
 *
 * Source pool (in priority order):
 *   1. Recently published trends   (`trend_topics` where status=published)
 *   2. Recently published expert   (`expert_picks` where status=published)
 *   3. Top-scored product analyses (`medications` with verdict + score≥80)
 */
export async function curateForSubscriber(
  subscriberId: number,
  options: { limit: number; sinceDays: number; dedupeDays: number }
): Promise<DigestItem[]> {
  const admin = await createAdminClient();
  const sinceIso = new Date(
    Date.now() - options.sinceDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const dedupeIso = new Date(
    Date.now() - options.dedupeDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // 1. Items previously sent to this subscriber (dedup window)
  const { data: alreadySent } = await admin
    .from("digest_log")
    .select("item_url")
    .eq("subscriber_id", subscriberId)
    .gte("sent_at", dedupeIso);
  const seen = new Set((alreadySent ?? []).map((r) => r.item_url as string));

  const candidates: DigestItem[] = [];

  // 2. Trends — highest priority (most fresh, most clickable)
  const { data: trends } = await admin
    .from("trend_topics")
    .select("slug, query_text, headline, image_url, category, published_at, created_at")
    .eq("status", "published")
    .gte("published_at", sinceIso)
    .order("published_at", { ascending: false })
    .limit(15);
  for (const t of trends ?? []) {
    if (!t.slug) continue;
    const url = `${SITE_URL}/trending/${t.slug}`;
    if (seen.has(url)) continue;
    candidates.push({
      url,
      kind: "trend",
      slug: t.slug as string,
      title: (t.headline as string) ?? (t.query_text as string),
      description: `Trending in ${t.category === "health" ? "Health" : "Beauty"} — pharmacist take inside.`,
      imageUrl: (t.image_url as string) ?? null,
      publishedAt: (t.published_at as string) ?? (t.created_at as string),
    });
  }

  // 3. Dr.'s Analysis (expert)
  const { data: experts } = await admin
    .from("expert_picks")
    .select("slug, title, summary, thumbnail_url, category, published_at, created_at")
    .eq("status", "published")
    .gte("published_at", sinceIso)
    .order("published_at", { ascending: false })
    .limit(8);
  for (const e of experts ?? []) {
    if (!e.slug) continue;
    const url = `${SITE_URL}/expert/${e.slug}`;
    if (seen.has(url)) continue;
    candidates.push({
      url,
      kind: "expert",
      slug: e.slug as string,
      title: e.title as string,
      description: (e.summary as string)?.slice(0, 140) ?? "",
      imageUrl: (e.thumbnail_url as string) ?? null,
      publishedAt: (e.published_at as string) ?? (e.created_at as string),
    });
  }

  // 4. Top-scored product analyses (filler — only used if trends/experts thin)
  if (candidates.length < options.limit) {
    const { data: meds } = await admin
      .from("medications")
      .select("slug, name, verdict, image_url, comparison_score, updated_at")
      .eq("approval_status", "approved")
      .not("verdict", "is", null)
      .gte("comparison_score", 80)
      .order("updated_at", { ascending: false })
      .limit(20);
    for (const m of meds ?? []) {
      if (!m.slug) continue;
      const url = `${SITE_URL}/analysis/${m.slug}`;
      if (seen.has(url)) continue;
      candidates.push({
        url,
        kind: "analysis",
        slug: m.slug as string,
        title: m.name as string,
        description: `${m.comparison_score}/100 — ${(m.verdict as string).slice(0, 120)}`,
        imageUrl: (m.image_url as string) ?? null,
        publishedAt: (m.updated_at as string) ?? null,
      });
      if (candidates.length >= options.limit * 2) break;
    }
  }

  // Take the freshest `limit` items.
  candidates.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return candidates.slice(0, options.limit);
}

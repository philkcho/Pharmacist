"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ADMIN_EXCLUDE_CITY,
  EXCLUDE_ADMIN_CITY_FILTER,
} from "@/lib/analytics/admin-exclude";

// ── Types ──────────────────────────────────────────────────

export interface AnalyticsSummary {
  totalPageViews: number;
  uniqueVisitors: number;
  avgDuration: number | null;
  purchaseClicks: number;
  topPages: { path: string; count: number }[];
  topCountries: { country: string; visitors: number }[];
  topClickedProducts: { name: string; clicks: number }[];
  dailyPageViews: { date: string; count: number }[];
}

export interface PageViewDetail {
  id: number;
  visitorId: string;
  path: string;
  referrer: string | null;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  durationSeconds: number | null;
  userAgent: string | null;
  createdAt: string;
}

// ── Summary with date range ────────────────────────────────

export async function getAnalyticsSummary(
  from: string,
  to: string
): Promise<AnalyticsSummary> {
  const admin = createAdminClient();
  // to는 해당 날짜 끝까지 포함
  const toEnd = to + "T23:59:59.999Z";
  const fromStart = from + "T00:00:00.000Z";

  // Page views count
  const { count: totalPageViews } = await admin
    .from("page_views")
    .select("id", { count: "exact", head: true })
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .or(EXCLUDE_ADMIN_CITY_FILTER);

  // Unique visitors
  const { data: visitorRows } = await admin
    .from("page_views")
    .select("visitor_id")
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .or(EXCLUDE_ADMIN_CITY_FILTER);
  const uniqueVisitors = new Set(
    (visitorRows ?? []).map((r) => r.visitor_id)
  ).size;

  // Avg duration
  const { data: durRows } = await admin
    .from("page_views")
    .select("duration_seconds")
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .not("duration_seconds", "is", null)
    .or(EXCLUDE_ADMIN_CITY_FILTER);
  const durations = (durRows ?? [])
    .map((r) => r.duration_seconds as number)
    .filter((d) => d > 0);
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  // Purchase clicks
  const { count: purchaseClicks } = await admin
    .from("purchase_click_events")
    .select("id", { count: "exact", head: true })
    .gte("clicked_at", fromStart)
    .lte("clicked_at", toEnd);

  // Top pages
  const { data: pageRows } = await admin
    .from("page_views")
    .select("path")
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .or(EXCLUDE_ADMIN_CITY_FILTER);
  const pageCounts = new Map<string, number>();
  for (const r of pageRows ?? []) {
    pageCounts.set(r.path, (pageCounts.get(r.path) ?? 0) + 1);
  }
  const topPages = [...pageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Top countries
  const { data: countryRows } = await admin
    .from("page_views")
    .select("country, visitor_id")
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .not("country", "is", null)
    .or(EXCLUDE_ADMIN_CITY_FILTER);
  const countryVisitors = new Map<string, Set<string>>();
  for (const r of countryRows ?? []) {
    const c = r.country as string;
    if (!countryVisitors.has(c)) countryVisitors.set(c, new Set());
    countryVisitors.get(c)!.add(r.visitor_id as string);
  }
  const topCountries = [...countryVisitors.entries()]
    .map(([country, vis]) => ({ country, visitors: vis.size }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);

  // Top clicked products
  const { data: clickRows } = await admin
    .from("purchase_click_events")
    .select("medication_id")
    .gte("clicked_at", fromStart)
    .lte("clicked_at", toEnd);
  const medCounts = new Map<number, number>();
  for (const r of clickRows ?? []) {
    const id = r.medication_id as number;
    medCounts.set(id, (medCounts.get(id) ?? 0) + 1);
  }
  const topMedIds = [...medCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  let topClickedProducts: { name: string; clicks: number }[] = [];
  if (topMedIds.length > 0) {
    const { data: meds } = await admin
      .from("medications")
      .select("id, name")
      .in("id", topMedIds.map(([id]) => id));
    const nameMap = new Map(
      (meds ?? []).map((m) => [m.id as number, m.name as string])
    );
    topClickedProducts = topMedIds.map(([id, clicks]) => ({
      name: nameMap.get(id) ?? `#${id}`,
      clicks,
    }));
  }

  // Daily page views (for chart)
  const { data: dailyRows } = await admin
    .from("page_views")
    .select("created_at")
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .or(EXCLUDE_ADMIN_CITY_FILTER)
    .order("created_at");
  const dailyMap = new Map<string, number>();
  for (const r of dailyRows ?? []) {
    const day = (r.created_at as string).slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
  }
  // Fill in missing days
  const dailyPageViews: { date: string; count: number }[] = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    dailyPageViews.push({ date: key, count: dailyMap.get(key) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }

  return {
    totalPageViews: totalPageViews ?? 0,
    uniqueVisitors,
    avgDuration,
    purchaseClicks: purchaseClicks ?? 0,
    topPages,
    topCountries,
    topClickedProducts,
    dailyPageViews,
  };
}

// ── Unique visitor aggregation ─────────────────────────────

export interface VisitorDetail {
  visitorId: string;
  pageCount: number;
  firstVisitAt: string;
  lastVisitAt: string;
  totalDurationSeconds: number;
  country: string | null;
  city: string | null;
  ip: string | null;
  referrer: string | null;
  topPath: string;
  paths: string[]; // unique paths visited, up to 10
}

// Group page_views by visitor_id and return per-visitor rollup.
// In-memory group since Supabase client can't do GROUP BY directly.
// Caps at 5000 rows so a bad date range doesn't blow memory.
export async function getUniqueVisitorDetails(
  from: string,
  to: string
): Promise<VisitorDetail[]> {
  const admin = createAdminClient();
  const fromStart = from + "T00:00:00.000Z";
  const toEnd = to + "T23:59:59.999Z";

  const { data } = await admin
    .from("page_views")
    .select(
      "visitor_id, path, referrer, ip, country, city, duration_seconds, created_at"
    )
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .or(EXCLUDE_ADMIN_CITY_FILTER)
    .order("created_at", { ascending: true })
    .limit(5000);

  const byVisitor = new Map<string, VisitorDetail & { pathCounts: Map<string, number> }>();

  for (const row of data ?? []) {
    const id = row.visitor_id as string;
    if (!id) continue;
    const createdAt = row.created_at as string;
    const path = row.path as string;
    const dur = (row.duration_seconds as number | null) ?? 0;

    let v = byVisitor.get(id);
    if (!v) {
      v = {
        visitorId: id,
        pageCount: 0,
        firstVisitAt: createdAt,
        lastVisitAt: createdAt,
        totalDurationSeconds: 0,
        country: (row.country as string | null) ?? null,
        city: (row.city as string | null) ?? null,
        ip: (row.ip as string | null) ?? null,
        referrer: (row.referrer as string | null) ?? null,
        topPath: path,
        paths: [],
        pathCounts: new Map(),
      };
      byVisitor.set(id, v);
    }
    v.pageCount += 1;
    v.lastVisitAt = createdAt;
    v.totalDurationSeconds += dur;
    v.pathCounts.set(path, (v.pathCounts.get(path) ?? 0) + 1);
    // First non-null values win for geo/referrer (initial context matters most)
    if (!v.country && row.country) v.country = row.country as string;
    if (!v.city && row.city) v.city = row.city as string;
    if (!v.referrer && row.referrer) v.referrer = row.referrer as string;
  }

  // Finalize per-visitor: sort paths by count desc, capture top N
  const result: VisitorDetail[] = [];
  for (const v of byVisitor.values()) {
    const sortedPaths = [...v.pathCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);
    result.push({
      visitorId: v.visitorId,
      pageCount: v.pageCount,
      firstVisitAt: v.firstVisitAt,
      lastVisitAt: v.lastVisitAt,
      totalDurationSeconds: v.totalDurationSeconds,
      country: v.country,
      city: v.city,
      ip: v.ip,
      referrer: v.referrer,
      topPath: sortedPaths[0] ?? "",
      paths: sortedPaths.slice(0, 10),
    });
  }

  // Sort by last visit, most recent first
  result.sort((a, b) => b.lastVisitAt.localeCompare(a.lastVisitAt));
  return result;
}

// ── Detail page view list ──────────────────────────────────

export async function getPageViewDetails(
  from: string,
  to: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: PageViewDetail[]; total: number }> {
  const admin = createAdminClient();
  const fromStart = from + "T00:00:00.000Z";
  const toEnd = to + "T23:59:59.999Z";
  const offset = (page - 1) * pageSize;

  const { count } = await admin
    .from("page_views")
    .select("id", { count: "exact", head: true })
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .or(EXCLUDE_ADMIN_CITY_FILTER);

  const { data } = await admin
    .from("page_views")
    .select(
      "id, visitor_id, path, referrer, ip, country, region, city, duration_seconds, user_agent, created_at"
    )
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .or(EXCLUDE_ADMIN_CITY_FILTER)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const rows: PageViewDetail[] = (data ?? []).map((r) => ({
    id: r.id as number,
    visitorId: r.visitor_id as string,
    path: r.path as string,
    referrer: (r.referrer as string) ?? null,
    ip: (r.ip as string) ?? null,
    country: (r.country as string) ?? null,
    region: (r.region as string) ?? null,
    city: (r.city as string) ?? null,
    durationSeconds: (r.duration_seconds as number) ?? null,
    userAgent: (r.user_agent as string) ?? null,
    createdAt: r.created_at as string,
  }));

  return { data: rows, total: count ?? 0 };
}

// ── Purchase click detail list ─────────────────────────────

export interface ClickDetail {
  id: number;
  productName: string;
  productSlug: string | null;
  retailerName: string;
  referrerType: string;
  clickedAt: string;
  // Visitor context (session-joined; null when session_id absent or no match)
  country: string | null;
  city: string | null;
  referrerHost: string | null;
  fromPath: string | null;
}

export async function getClickDetails(
  from: string,
  to: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: ClickDetail[]; total: number }> {
  const admin = createAdminClient();
  const fromStart = from + "T00:00:00.000Z";
  const toEnd = to + "T23:59:59.999Z";
  const offset = (page - 1) * pageSize;

  const { count } = await admin
    .from("purchase_click_events")
    .select("id", { count: "exact", head: true })
    .gte("clicked_at", fromStart)
    .lte("clicked_at", toEnd);

  const { data } = await admin
    .from("purchase_click_events")
    .select(
      "id, medication_id, retailer_id, referrer_type, session_id, clicked_at"
    )
    .gte("clicked_at", fromStart)
    .lte("clicked_at", toEnd)
    .order("clicked_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (!data || data.length === 0) return { data: [], total: count ?? 0 };

  // Resolve product and retailer names
  const medIds = [...new Set(data.map((r) => r.medication_id as number))];
  const retIds = [...new Set(data.map((r) => r.retailer_id as number))];
  const sessionIds = [
    ...new Set(
      data
        .map((r) => r.session_id as string | null)
        .filter((s): s is string => !!s)
    ),
  ];

  const [{ data: meds }, { data: rets }, { data: sessionViews }] =
    await Promise.all([
      admin.from("medications").select("id, name, slug").in("id", medIds),
      admin.from("retailers").select("id, name").in("id", retIds),
      sessionIds.length > 0
        ? admin
            .from("page_views")
            .select("session_id, country, city, referrer, path, created_at")
            .in("session_id", sessionIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

  const medMap = new Map(
    (meds ?? []).map((m) => [
      m.id as number,
      { name: m.name as string, slug: (m.slug as string) ?? null },
    ])
  );
  const retMap = new Map(
    (rets ?? []).map((r) => [r.id as number, r.name as string])
  );

  // Per session, collect the most recent page_view BEFORE the click and the
  // earliest referrer domain (best hint at the original traffic source).
  interface SessionCtx {
    country: string | null;
    city: string | null;
    referrerHost: string | null;
    fromPath: string | null;
  }
  const sessionCtx = new Map<string, SessionCtx>();
  for (const v of (sessionViews ?? []) as Array<{
    session_id: string;
    country: string | null;
    city: string | null;
    referrer: string | null;
    path: string | null;
  }>) {
    const sid = v.session_id;
    if (!sid) continue;
    const ctx = sessionCtx.get(sid) ?? {
      country: null,
      city: null,
      referrerHost: null,
      fromPath: null,
    };
    // First (most recent, because ordered desc) becomes fromPath
    if (!ctx.fromPath && v.path) ctx.fromPath = v.path;
    // Any non-null country/city wins — geolocation is stable within a session
    if (!ctx.country && v.country) ctx.country = v.country;
    if (!ctx.city && v.city) ctx.city = v.city;
    // External referrer host (first external one we see)
    const host = referrerHost(v.referrer);
    if (!ctx.referrerHost && host) ctx.referrerHost = host;
    sessionCtx.set(sid, ctx);
  }

  const rows: ClickDetail[] = data
    .map((r) => {
      const med = medMap.get(r.medication_id as number);
      const sid = r.session_id as string | null;
      const ctx = sid ? sessionCtx.get(sid) : null;
      return {
        id: r.id as number,
        productName: med?.name ?? `#${r.medication_id}`,
        productSlug: med?.slug ?? null,
        retailerName:
          retMap.get(r.retailer_id as number) ?? `#${r.retailer_id}`,
        referrerType: (r.referrer_type as string) ?? "unknown",
        clickedAt: r.clicked_at as string,
        country: ctx?.country ?? null,
        city: ctx?.city ?? null,
        referrerHost: ctx?.referrerHost ?? null,
        fromPath: ctx?.fromPath ?? null,
      };
    })
    // Exclude admin self-clicks (city match). purchase_click_events has no
    // country/city directly, so we can only filter after the session enrichment.
    .filter((r) => r.city !== ADMIN_EXCLUDE_CITY);

  return { data: rows, total: count ?? 0 };
}

// ── Top referrers (external traffic sources) ───────────────

export interface TopReferrer {
  host: string;
  visitors: number;
}

function referrerHost(ref: string | null | undefined): string | null {
  if (!ref) return null;
  try {
    const u = new URL(ref);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    // Skip internal self-referrals
    if (host.endsWith("aipharmcare.com") || host === "localhost") return null;
    return host;
  } catch {
    return null;
  }
}

export async function getTopReferrers(
  from: string,
  to: string
): Promise<TopReferrer[]> {
  const admin = createAdminClient();
  const fromStart = from + "T00:00:00.000Z";
  const toEnd = to + "T23:59:59.999Z";

  const { data } = await admin
    .from("page_views")
    .select("visitor_id, referrer")
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .not("referrer", "is", null)
    .or(EXCLUDE_ADMIN_CITY_FILTER);

  const byHost = new Map<string, Set<string>>();
  for (const r of data ?? []) {
    const host = referrerHost(r.referrer as string);
    if (!host) continue;
    if (!byHost.has(host)) byHost.set(host, new Set());
    byHost.get(host)!.add(r.visitor_id as string);
  }
  return [...byHost.entries()]
    .map(([host, vs]) => ({ host, visitors: vs.size }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);
}

// ── Top entry pages (first page a visitor lands on) ────────

export interface TopEntryPage {
  path: string;
  visitors: number;
}

export async function getTopEntryPages(
  from: string,
  to: string
): Promise<TopEntryPage[]> {
  const admin = createAdminClient();
  const fromStart = from + "T00:00:00.000Z";
  const toEnd = to + "T23:59:59.999Z";

  // Chronological fetch so per-visitor first-seen path wins
  const { data } = await admin
    .from("page_views")
    .select("visitor_id, path, created_at")
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .or(EXCLUDE_ADMIN_CITY_FILTER)
    .order("created_at", { ascending: true })
    .limit(10000);

  const firstPathByVisitor = new Map<string, string>();
  for (const r of data ?? []) {
    const vid = r.visitor_id as string;
    if (!firstPathByVisitor.has(vid)) {
      firstPathByVisitor.set(vid, r.path as string);
    }
  }
  const pathCounts = new Map<string, number>();
  for (const path of firstPathByVisitor.values()) {
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
  }
  return [...pathCounts.entries()]
    .map(([path, visitors]) => ({ path, visitors }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);
}

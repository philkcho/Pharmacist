"use server";

import { createAdminClient } from "@/lib/supabase/admin";

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
    .lte("created_at", toEnd);

  // Unique visitors
  const { data: visitorRows } = await admin
    .from("page_views")
    .select("visitor_id")
    .gte("created_at", fromStart)
    .lte("created_at", toEnd);
  const uniqueVisitors = new Set(
    (visitorRows ?? []).map((r) => r.visitor_id)
  ).size;

  // Avg duration
  const { data: durRows } = await admin
    .from("page_views")
    .select("duration_seconds")
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
    .not("duration_seconds", "is", null);
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
    .lte("created_at", toEnd);
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
    .not("country", "is", null);
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
    .lte("created_at", toEnd);

  const { data } = await admin
    .from("page_views")
    .select(
      "id, visitor_id, path, referrer, ip, country, region, city, duration_seconds, user_agent, created_at"
    )
    .gte("created_at", fromStart)
    .lte("created_at", toEnd)
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
  retailerName: string;
  referrerType: string;
  clickedAt: string;
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
    .select("id, medication_id, retailer_id, referrer_type, clicked_at")
    .gte("clicked_at", fromStart)
    .lte("clicked_at", toEnd)
    .order("clicked_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (!data || data.length === 0) return { data: [], total: count ?? 0 };

  // Resolve product and retailer names
  const medIds = [...new Set(data.map((r) => r.medication_id as number))];
  const retIds = [...new Set(data.map((r) => r.retailer_id as number))];

  const [{ data: meds }, { data: rets }] = await Promise.all([
    admin.from("medications").select("id, name").in("id", medIds),
    admin.from("retailers").select("id, name").in("id", retIds),
  ]);

  const medMap = new Map((meds ?? []).map((m) => [m.id as number, m.name as string]));
  const retMap = new Map((rets ?? []).map((r) => [r.id as number, r.name as string]));

  const rows: ClickDetail[] = data.map((r) => ({
    id: r.id as number,
    productName: medMap.get(r.medication_id as number) ?? `#${r.medication_id}`,
    retailerName: retMap.get(r.retailer_id as number) ?? `#${r.retailer_id}`,
    referrerType: (r.referrer_type as string) ?? "unknown",
    clickedAt: r.clicked_at as string,
  }));

  return { data: rows, total: count ?? 0 };
}

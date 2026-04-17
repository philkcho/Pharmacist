import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  FolderOpen,
  Pill,
  Eye,
  Users,
  Globe,
  Clock,
  ShoppingCart,
  MousePointerClick,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Helpers ────────────────────────────────────────────────
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function fmtDuration(seconds: number | null): string {
  if (!seconds || seconds < 1) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Data fetching ──────────────────────────────────────────
async function getDashboardStats() {
  const admin = createAdminClient();

  const [articles, published, categories, medications] = await Promise.all([
    admin.from("articles").select("id", { count: "exact", head: true }),
    admin
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    admin.from("categories").select("id", { count: "exact", head: true }),
    admin.from("medications").select("id", { count: "exact", head: true }),
  ]);

  return {
    totalArticles: articles.count ?? 0,
    publishedArticles: published.count ?? 0,
    totalCategories: categories.count ?? 0,
    totalMedications: medications.count ?? 0,
  };
}

async function getAnalyticsStats() {
  const admin = createAdminClient();
  const since7d = daysAgo(7);
  const since30d = daysAgo(30);
  const sinceToday = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";

  // ── Visitor & page view counts ──
  const [pvToday, pv7d, pv30d] = await Promise.all([
    admin
      .from("page_views")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceToday),
    admin
      .from("page_views")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since7d),
    admin
      .from("page_views")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since30d),
  ]);

  // Unique visitors (30d) — fetch visitor_ids and count distinct
  const { data: visitorRows } = await admin
    .from("page_views")
    .select("visitor_id")
    .gte("created_at", since30d);
  const uniqueVisitors30d = new Set(
    (visitorRows ?? []).map((r) => r.visitor_id)
  ).size;

  // Unique visitors today
  const { data: visitorRowsToday } = await admin
    .from("page_views")
    .select("visitor_id")
    .gte("created_at", sinceToday);
  const uniqueVisitorsToday = new Set(
    (visitorRowsToday ?? []).map((r) => r.visitor_id)
  ).size;

  // ── Average duration (30d) ──
  const { data: durRows } = await admin
    .from("page_views")
    .select("duration_seconds")
    .gte("created_at", since30d)
    .not("duration_seconds", "is", null);
  const durations = (durRows ?? [])
    .map((r) => r.duration_seconds as number)
    .filter((d) => d > 0);
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  // ── Top pages (30d, top 10) ──
  const { data: pageRows } = await admin
    .from("page_views")
    .select("path")
    .gte("created_at", since30d);
  const pageCounts = new Map<string, number>();
  for (const r of pageRows ?? []) {
    pageCounts.set(r.path, (pageCounts.get(r.path) ?? 0) + 1);
  }
  const topPages = [...pageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // ── Top countries (30d, top 10) ──
  const { data: countryRows } = await admin
    .from("page_views")
    .select("country, visitor_id")
    .gte("created_at", since30d)
    .not("country", "is", null);
  const countryVisitors = new Map<string, Set<string>>();
  for (const r of countryRows ?? []) {
    const c = r.country as string;
    if (!countryVisitors.has(c)) countryVisitors.set(c, new Set());
    countryVisitors.get(c)!.add(r.visitor_id as string);
  }
  const topCountries = [...countryVisitors.entries()]
    .map(([country, visitors]) => ({ country, visitors: visitors.size }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);

  // ── Purchase clicks ──
  const [clicksToday, clicks7d] = await Promise.all([
    admin
      .from("purchase_click_events")
      .select("id", { count: "exact", head: true })
      .gte("clicked_at", sinceToday),
    admin
      .from("purchase_click_events")
      .select("id", { count: "exact", head: true })
      .gte("clicked_at", since7d),
  ]);

  // Top clicked products (30d)
  const { data: clickRows } = await admin
    .from("purchase_click_events")
    .select("medication_id")
    .gte("clicked_at", since30d);
  const medClickCounts = new Map<number, number>();
  for (const r of clickRows ?? []) {
    const id = r.medication_id as number;
    medClickCounts.set(id, (medClickCounts.get(id) ?? 0) + 1);
  }
  const topMedIds = [...medClickCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let topClickedProducts: { name: string; clicks: number }[] = [];
  if (topMedIds.length > 0) {
    const { data: meds } = await admin
      .from("medications")
      .select("id, name")
      .in(
        "id",
        topMedIds.map(([id]) => id)
      );
    const nameMap = new Map(
      (meds ?? []).map((m) => [m.id as number, m.name as string])
    );
    topClickedProducts = topMedIds.map(([id, clicks]) => ({
      name: nameMap.get(id) ?? `Product #${id}`,
      clicks,
    }));
  }

  return {
    pageViewsToday: pvToday.count ?? 0,
    pageViews7d: pv7d.count ?? 0,
    pageViews30d: pv30d.count ?? 0,
    uniqueVisitorsToday,
    uniqueVisitors30d,
    avgDuration,
    topPages,
    topCountries,
    clicksToday: clicksToday.count ?? 0,
    clicks7d: clicks7d.count ?? 0,
    topClickedProducts,
  };
}

// ── Page component ─────────────────────────────────────────
export default async function DashboardPage() {
  const [stats, analytics] = await Promise.all([
    getDashboardStats(),
    getAnalyticsStats(),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Content stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Articles"
          value={stats.totalArticles}
          sub={`${stats.publishedArticles} published`}
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Categories"
          value={stats.totalCategories}
          icon={<FolderOpen className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Medications"
          value={stats.totalMedications}
          icon={<Pill className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Expert Analyses"
          value={stats.publishedArticles}
          sub="published"
          icon={<Eye className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Visitor analytics */}
      <h2 className="text-lg font-semibold">Visitor Analytics</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Visitors Today"
          value={analytics.uniqueVisitorsToday}
          sub={`${analytics.pageViewsToday} page views`}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          href="/analytics?tab=visitors"
        />
        <StatCard
          title="Page Views (7d)"
          value={analytics.pageViews7d}
          icon={<Eye className="h-4 w-4 text-muted-foreground" />}
          href="/analytics?tab=pageviews"
        />
        <StatCard
          title="Avg. Time on Page"
          value={fmtDuration(analytics.avgDuration)}
          sub="last 30 days"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          href="/analytics?tab=pageviews"
        />
        <StatCard
          title="Purchase Clicks (7d)"
          value={analytics.clicks7d}
          sub={`${analytics.clicksToday} today`}
          icon={<MousePointerClick className="h-4 w-4 text-muted-foreground" />}
          href="/analytics?tab=clicks"
        />
      </div>

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Pages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Eye className="h-4 w-4" />
              Top Pages (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Page</th>
                    <th className="pb-2 text-right font-medium">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topPages.map((p) => (
                    <tr key={p.path} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{p.path}</td>
                      <td className="py-2 text-right">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Top Countries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Globe className="h-4 w-4" />
              Top Countries (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topCountries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Country</th>
                    <th className="pb-2 text-right font-medium">Visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topCountries.map((c) => (
                    <tr key={c.country} className="border-b last:border-0">
                      <td className="py-2">{c.country}</td>
                      <td className="py-2 text-right">{c.visitors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Clicked Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <ShoppingCart className="h-4 w-4" />
            Top Clicked Products (30d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.topClickedProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No click data yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 text-right font-medium">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topClickedProducts.map((p) => (
                  <tr key={p.name} className="border-b last:border-0">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-right">{p.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Reusable stat card ─────────────────────────────────────
function StatCard({
  title,
  value,
  sub,
  icon,
  href,
}: {
  title: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const card = (
    <Card className={href ? "cursor-pointer transition-colors hover:border-primary/40 hover:shadow-md" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && (
          <p className="text-xs text-muted-foreground">{sub}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }
  return card;
}

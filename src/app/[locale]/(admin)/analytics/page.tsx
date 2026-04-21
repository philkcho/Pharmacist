"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Users,
  Eye,
  Clock,
  Globe,
  MousePointerClick,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  List,
} from "lucide-react";
import {
  getAnalyticsSummary,
  getPageViewDetails,
  getClickDetails,
  getUniqueVisitorDetails,
  type AnalyticsSummary,
  type PageViewDetail,
  type ClickDetail,
  type VisitorDetail,
} from "@/lib/actions/analytics";

// ── Helpers ────────────────────────────────────────────────

function fmtDuration(seconds: number | null): string {
  if (!seconds || seconds < 1) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = toDateStr(now);
  const d = new Date(now);
  switch (preset) {
    case "today":
      return { from: to, to };
    case "7d":
      d.setDate(d.getDate() - 6);
      return { from: toDateStr(d), to };
    case "30d":
      d.setDate(d.getDate() - 29);
      return { from: toDateStr(d), to };
    case "90d":
      d.setDate(d.getDate() - 89);
      return { from: toDateStr(d), to };
    default:
      d.setDate(d.getDate() - 6);
      return { from: toDateStr(d), to };
  }
}

// ── Main Page ──────────────────────────────────────────────

export default function AnalyticsPage() {
  const [preset, setPreset] = useState("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [details, setDetails] = useState<PageViewDetail[]>([]);
  const [detailsTotal, setDetailsTotal] = useState(0);
  const [detailsPage, setDetailsPage] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [clicks, setClicks] = useState<ClickDetail[]>([]);
  const [clicksTotal, setClicksTotal] = useState(0);
  const [clicksPage, setClicksPage] = useState(1);
  const [showClicks, setShowClicks] = useState(false);
  const [visitors, setVisitors] = useState<VisitorDetail[]>([]);
  const [showVisitors, setShowVisitors] = useState(false);
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  // Initialize date range + auto-open tab from query param
  useEffect(() => {
    const range = getPresetRange("7d");
    setFrom(range.from);
    setTo(range.to);

    const tab = searchParams.get("tab");
    if (tab === "visitors" || tab === "pageviews") setShowDetails(true);
    if (tab === "clicks") setShowClicks(true);
  }, [searchParams]);

  // Fetch summary when dates change
  useEffect(() => {
    if (!from || !to) return;
    startTransition(async () => {
      const data = await getAnalyticsSummary(from, to);
      setSummary(data);
    });
  }, [from, to]);

  // Fetch details when page or visibility changes
  useEffect(() => {
    if (!showDetails || !from || !to) return;
    startTransition(async () => {
      const res = await getPageViewDetails(from, to, detailsPage, 50);
      setDetails(res.data);
      setDetailsTotal(res.total);
    });
  }, [showDetails, from, to, detailsPage]);

  // Fetch click details
  useEffect(() => {
    if (!showClicks || !from || !to) return;
    startTransition(async () => {
      const res = await getClickDetails(from, to, clicksPage, 50);
      setClicks(res.data);
      setClicksTotal(res.total);
    });
  }, [showClicks, from, to, clicksPage]);

  // Fetch unique visitor rollup
  useEffect(() => {
    if (!showVisitors || !from || !to) return;
    startTransition(async () => {
      const data = await getUniqueVisitorDetails(from, to);
      setVisitors(data);
    });
  }, [showVisitors, from, to]);

  function applyPreset(p: string) {
    setPreset(p);
    const range = getPresetRange(p);
    setFrom(range.from);
    setTo(range.to);
    setDetailsPage(1);
    setClicksPage(1);
  }

  const totalDetailPages = Math.ceil(detailsTotal / 50);
  const totalClickPages = Math.ceil(clicksTotal / 50);
  const presets = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" },
    { key: "90d", label: "90 Days" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6 text-primary" />
          Analytics
        </h1>

        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={preset === p.key ? "default" : "outline"}
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
          <span className="text-sm text-muted-foreground">or</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPreset("custom");
              setDetailsPage(1);
            }}
            className="rounded border px-2 py-1 text-sm"
          />
          <span className="text-sm text-muted-foreground">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPreset("custom");
              setDetailsPage(1);
            }}
            className="rounded border px-2 py-1 text-sm"
          />
        </div>
      </div>

      {isPending && !summary && (
        <p className="text-center text-muted-foreground">Loading...</p>
      )}

      {summary && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Page Views"
              value={summary.totalPageViews}
              icon={<Eye className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Unique Visitors"
              value={summary.uniqueVisitors}
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              onClick={() => setShowVisitors((v) => !v)}
              active={showVisitors}
            />
            <StatCard
              title="Avg. Time on Page"
              value={fmtDuration(summary.avgDuration)}
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Purchase Clicks"
              value={summary.purchaseClicks}
              icon={
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              }
            />
          </div>

          {/* Unique Visitor Details (toggled by clicking the stat card) */}
          {showVisitors && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Unique Visitor Details ({visitors.length})
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowVisitors(false)}
                >
                  Hide
                </Button>
              </CardHeader>
              <CardContent>
                {visitors.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    {isPending ? "Loading..." : "No visitors in this period"}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Visitor</th>
                          <th className="pb-2 pr-4 font-medium">Pages</th>
                          <th className="pb-2 pr-4 font-medium">Total Time</th>
                          <th className="pb-2 pr-4 font-medium">First Visit</th>
                          <th className="pb-2 pr-4 font-medium">Last Visit</th>
                          <th className="pb-2 pr-4 font-medium">Country</th>
                          <th className="pb-2 pr-4 font-medium">City</th>
                          <th className="pb-2 pr-4 font-medium">Top Pages</th>
                          <th className="pb-2 font-medium">Referrer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visitors.map((v) => (
                          <tr
                            key={v.visitorId}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td
                              className="py-2 pr-4 font-mono text-[11px] text-muted-foreground"
                              title={v.visitorId}
                            >
                              {v.visitorId.slice(0, 8)}
                            </td>
                            <td className="py-2 pr-4 text-xs font-medium">
                              {v.pageCount}
                            </td>
                            <td className="py-2 pr-4 text-xs">
                              {fmtDuration(v.totalDurationSeconds)}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-4 text-xs">
                              {fmtDate(v.firstVisitAt)}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-4 text-xs">
                              {fmtDate(v.lastVisitAt)}
                            </td>
                            <td className="py-2 pr-4 text-xs">
                              {v.country ?? "—"}
                            </td>
                            <td className="py-2 pr-4 text-xs">
                              {v.city ?? "—"}
                            </td>
                            <td className="max-w-[280px] py-2 pr-4 font-mono text-[11px] text-muted-foreground">
                              <span className="block truncate" title={v.paths.join(" · ")}>
                                {v.paths.slice(0, 3).join(" · ")}
                                {v.paths.length > 3 ? ` +${v.paths.length - 3}` : ""}
                              </span>
                            </td>
                            <td className="max-w-[160px] truncate py-2 text-xs text-muted-foreground">
                              {v.referrer ?? "Direct"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Daily chart (simple bar) */}
          {summary.dailyPageViews.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Daily Page Views
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DailyChart data={summary.dailyPageViews} />
              </CardContent>
            </Card>
          )}

          {/* Tables row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Pages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4" />
                  Top Pages
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.topPages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Page</th>
                        <th className="pb-2 text-right font-medium">Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topPages.map((p) => (
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
                  Top Countries
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.topCountries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Country</th>
                        <th className="pb-2 text-right font-medium">
                          Visitors
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topCountries.map((c) => (
                        <tr
                          key={c.country}
                          className="border-b last:border-0"
                        >
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
                Top Clicked Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.topClickedProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No click data</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Product</th>
                      <th className="pb-2 text-right font-medium">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topClickedProducts.map((p) => (
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

          {/* Detail view toggle */}
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <List className="h-5 w-5" />
              Visitor Details
            </h2>
            <Button
              variant={showDetails ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowDetails(!showDetails);
                setDetailsPage(1);
              }}
            >
              {showDetails ? "Hide Details" : "Show Details"}
            </Button>
          </div>

          {/* Detail table */}
          {showDetails && (
            <Card>
              <CardContent className="pt-6">
                {details.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    {isPending ? "Loading..." : "No visits in this period"}
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Time</th>
                            <th className="pb-2 pr-4 font-medium">Page</th>
                            <th className="pb-2 pr-4 font-medium">Country</th>
                            <th className="pb-2 pr-4 font-medium">City</th>
                            <th className="pb-2 pr-4 font-medium">Duration</th>
                            <th className="pb-2 pr-4 font-medium">IP</th>
                            <th className="pb-2 font-medium">Referrer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.map((v) => (
                            <tr
                              key={v.id}
                              className="border-b last:border-0 hover:bg-muted/30"
                            >
                              <td className="whitespace-nowrap py-2 pr-4 text-xs">
                                {fmtDate(v.createdAt)}
                              </td>
                              <td className="py-2 pr-4 font-mono text-xs">
                                {v.path}
                              </td>
                              <td className="py-2 pr-4 text-xs">
                                {v.country ?? "—"}
                              </td>
                              <td className="py-2 pr-4 text-xs">
                                {v.city ?? "—"}
                              </td>
                              <td className="py-2 pr-4 text-xs">
                                {fmtDuration(v.durationSeconds)}
                              </td>
                              <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                                {v.ip ?? "—"}
                              </td>
                              <td className="max-w-[200px] truncate py-2 text-xs text-muted-foreground">
                                {v.referrer ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {detailsTotal} total visits — Page {detailsPage} of{" "}
                        {totalDetailPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={detailsPage <= 1}
                          onClick={() =>
                            setDetailsPage((p) => Math.max(1, p - 1))
                          }
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={detailsPage >= totalDetailPages}
                          onClick={() => setDetailsPage((p) => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Purchase Click Details toggle */}
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShoppingCart className="h-5 w-5" />
              Purchase Click Details
            </h2>
            <Button
              variant={showClicks ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowClicks(!showClicks);
                setClicksPage(1);
              }}
            >
              {showClicks ? "Hide Clicks" : "Show Clicks"}
            </Button>
          </div>

          {showClicks && (
            <Card>
              <CardContent className="pt-6">
                {clicks.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    {isPending ? "Loading..." : "No clicks in this period"}
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Time</th>
                            <th className="pb-2 pr-4 font-medium">Product</th>
                            <th className="pb-2 pr-4 font-medium">
                              Retailer
                            </th>
                            <th className="pb-2 font-medium">From</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clicks.map((c) => (
                            <tr
                              key={c.id}
                              className="border-b last:border-0 hover:bg-muted/30"
                            >
                              <td className="whitespace-nowrap py-2 pr-4 text-xs">
                                {fmtDate(c.clickedAt)}
                              </td>
                              <td className="py-2 pr-4 text-xs font-medium">
                                {c.productName}
                              </td>
                              <td className="py-2 pr-4 text-xs">
                                {c.retailerName}
                              </td>
                              <td className="py-2 text-xs text-muted-foreground">
                                {c.referrerType}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {clicksTotal} total clicks — Page {clicksPage} of{" "}
                        {totalClickPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={clicksPage <= 1}
                          onClick={() =>
                            setClicksPage((p) => Math.max(1, p - 1))
                          }
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={clicksPage >= totalClickPages}
                          onClick={() => setClicksPage((p) => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Simple bar chart (CSS-only, no chart library) ──────────

function DailyChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1" style={{ height: 120 }}>
      {data.map((d) => {
        const h = Math.max((d.count / max) * 100, 2);
        return (
          <div
            key={d.date}
            className="group relative flex-1"
            style={{ height: "100%" }}
          >
            <div
              className="absolute bottom-0 w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
              style={{ height: `${h}%` }}
            />
            {/* Tooltip */}
            <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-0.5 text-[10px] text-background group-hover:block">
              {d.date.slice(5)}: {d.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon,
  onClick,
  active,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <Card
      onClick={onClick}
      className={`${
        clickable ? "cursor-pointer transition-colors hover:border-primary/40" : ""
      } ${active ? "border-primary bg-primary/5" : ""}`}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
          {clickable && (
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              {active ? "(hide)" : "(click for details)"}
            </span>
          )}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

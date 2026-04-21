"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Users,
  Clock,
  Globe,
  MousePointerClick,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  LinkIcon,
  LogIn,
} from "lucide-react";
import {
  getAnalyticsSummary,
  getClickDetails,
  getTopReferrers,
  getTopEntryPages,
  getUniqueVisitorDetails,
  type AnalyticsSummary,
  type ClickDetail,
  type TopReferrer,
  type TopEntryPage,
  type VisitorDetail,
} from "@/lib/actions/analytics";

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

const CLICKS_PAGE_SIZE = 25;

export function DashboardAnalytics() {
  const [preset, setPreset] = useState("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [referrers, setReferrers] = useState<TopReferrer[]>([]);
  const [entryPages, setEntryPages] = useState<TopEntryPage[]>([]);
  const [clicks, setClicks] = useState<ClickDetail[]>([]);
  const [clicksTotal, setClicksTotal] = useState(0);
  const [clicksPage, setClicksPage] = useState(1);
  const [visitors, setVisitors] = useState<VisitorDetail[]>([]);
  const [showVisitors, setShowVisitors] = useState(false);
  const [isPending, startTransition] = useTransition();
  const conversionsRef = useRef<HTMLDivElement>(null);
  const visitorsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const range = getPresetRange("7d");
    setFrom(range.from);
    setTo(range.to);
  }, []);

  useEffect(() => {
    if (!from || !to) return;
    startTransition(async () => {
      const [s, r, e] = await Promise.all([
        getAnalyticsSummary(from, to),
        getTopReferrers(from, to),
        getTopEntryPages(from, to),
      ]);
      setSummary(s);
      setReferrers(r);
      setEntryPages(e);
    });
  }, [from, to]);

  useEffect(() => {
    if (!from || !to) return;
    startTransition(async () => {
      const res = await getClickDetails(from, to, clicksPage, CLICKS_PAGE_SIZE);
      setClicks(res.data);
      setClicksTotal(res.total);
    });
  }, [from, to, clicksPage]);

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
    setClicksPage(1);
  }

  const totalClickPages = Math.max(1, Math.ceil(clicksTotal / CLICKS_PAGE_SIZE));
  const presets = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" },
    { key: "90d", label: "90 Days" },
  ];

  const conversionRate =
    summary && summary.uniqueVisitors > 0
      ? (summary.purchaseClicks / summary.uniqueVisitors) * 100
      : 0;

  return (
    <div className="space-y-8">
      {/* Date range selector */}
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
            setClicksPage(1);
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
            setClicksPage(1);
          }}
          className="rounded border px-2 py-1 text-sm"
        />
      </div>

      {isPending && !summary && (
        <p className="text-center text-muted-foreground">Loading...</p>
      )}

      {summary && (
        <>
          {/* Traffic overview */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Unique Visitors"
              value={summary.uniqueVisitors}
              sub={`${summary.totalPageViews} page views`}
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              onClick={() => {
                setShowVisitors((v) => {
                  const next = !v;
                  if (next) {
                    requestAnimationFrame(() =>
                      visitorsRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    );
                  }
                  return next;
                });
              }}
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
              onClick={() =>
                conversionsRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            />
            <StatCard
              title="Conversion Rate"
              value={`${conversionRate.toFixed(2)}%`}
              sub="clicks ÷ visitors"
              icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
            />
          </div>

          {/* Unique Visitor Details — toggled via the Unique Visitors card */}
          {showVisitors && (
            <div ref={visitorsRef}>
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
                            <th className="pb-2 pr-4 font-medium">
                              First Visit
                            </th>
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
                                <span
                                  className="block truncate"
                                  title={v.paths.join(" · ")}
                                >
                                  {v.paths.slice(0, 3).join(" · ")}
                                  {v.paths.length > 3
                                    ? ` +${v.paths.length - 3}`
                                    : ""}
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
            </div>
          )}

          {/* Daily chart */}
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

          {/* Where visitors came from */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">
              Where Visitors Came From
            </h2>
            <div className="grid gap-6 lg:grid-cols-3">
              <MiniTable
                title="Top Countries"
                icon={<Globe className="h-4 w-4" />}
                empty="No data"
                rows={summary.topCountries.map((c) => ({
                  key: c.country,
                  left: c.country,
                  right: c.visitors,
                }))}
                rightLabel="Visitors"
              />
              <MiniTable
                title="Top Referrers"
                icon={<LinkIcon className="h-4 w-4" />}
                empty="Mostly direct traffic"
                rows={referrers.map((r) => ({
                  key: r.host,
                  left: r.host,
                  right: r.visitors,
                }))}
                rightLabel="Visitors"
              />
              <MiniTable
                title="Top Entry Pages"
                icon={<LogIn className="h-4 w-4" />}
                empty="No data"
                rows={entryPages.map((e) => ({
                  key: e.path,
                  left: <span className="font-mono text-xs">{e.path}</span>,
                  right: e.visitors,
                }))}
                rightLabel="Visitors"
              />
            </div>
          </div>

          {/* Top pages — engagement */}
          <div className="grid gap-6 lg:grid-cols-2">
            <MiniTable
              title="Top Pages (by views)"
              icon={<Eye className="h-4 w-4" />}
              empty="No data"
              rows={summary.topPages.map((p) => ({
                key: p.path,
                left: <span className="font-mono text-xs">{p.path}</span>,
                right: p.count,
              }))}
              rightLabel="Views"
            />
            <MiniTable
              title="Top Clicked Products"
              icon={<ShoppingCart className="h-4 w-4" />}
              empty="No click data"
              rows={summary.topClickedProducts.map((p) => ({
                key: p.name,
                left: p.name,
                right: p.clicks,
              }))}
              rightLabel="Clicks"
            />
          </div>

          {/* Purchase conversions — who clicked, from where */}
          <div ref={conversionsRef} className="scroll-mt-20">
            <h2 className="mb-4 text-lg font-semibold">Purchase Conversions</h2>
            <Card>
              <CardContent className="pt-6">
                {clicks.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    {isPending
                      ? "Loading..."
                      : "No purchase clicks in this period"}
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Time</th>
                            <th className="pb-2 pr-4 font-medium">Product</th>
                            <th className="pb-2 pr-4 font-medium">Retailer</th>
                            <th className="pb-2 pr-4 font-medium">
                              Clicked From
                            </th>
                            <th className="pb-2 pr-4 font-medium">Location</th>
                            <th className="pb-2 font-medium">Referrer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clicks.map((c) => {
                            const locParts = [c.city, c.country].filter(
                              Boolean
                            );
                            return (
                              <tr
                                key={c.id}
                                className="border-b last:border-0 hover:bg-muted/30"
                              >
                                <td className="whitespace-nowrap py-2 pr-4 text-xs">
                                  {fmtDate(c.clickedAt)}
                                </td>
                                <td className="py-2 pr-4 text-xs font-medium">
                                  {c.productSlug ? (
                                    <Link
                                      href={`/analysis/${c.productSlug}`}
                                      className="hover:underline"
                                      target="_blank"
                                    >
                                      {c.productName}
                                    </Link>
                                  ) : (
                                    c.productName
                                  )}
                                </td>
                                <td className="py-2 pr-4 text-xs">
                                  {c.retailerName}
                                </td>
                                <td className="py-2 pr-4 text-xs">
                                  {c.fromPath ? (
                                    <span className="font-mono">
                                      {c.fromPath}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      {c.referrerType}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 pr-4 text-xs text-muted-foreground">
                                  {locParts.length ? locParts.join(", ") : "—"}
                                </td>
                                <td className="py-2 text-xs text-muted-foreground">
                                  {c.referrerHost ?? "direct"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {clicksTotal > CLICKS_PAGE_SIZE && (
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
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ── UI primitives ──────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  icon,
  onClick,
  active,
}: {
  title: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <Card
      onClick={onClick}
      className={`${
        clickable
          ? "cursor-pointer transition-colors hover:border-primary/40"
          : ""
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
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MiniTable({
  title,
  icon,
  rows,
  rightLabel,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { key: string; left: React.ReactNode; right: React.ReactNode }[];
  rightLabel: string;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-2">{r.left}</td>
                  <td className="py-2 text-right">{r.right}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

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
            <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-0.5 text-[10px] text-background group-hover:block">
              {d.date.slice(5)}: {d.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  MessageCircleQuestion,
  Users,
  Sparkles,
  AtSign,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRecommendationsSummary } from "@/lib/actions/recommendations";
import { DashboardAnalytics } from "./dashboard-analytics";

// Rolling-window boundaries used across the stat cards. Today = since UTC
// midnight. This week = since the most recent Monday at 00:00 UTC. Both
// are computed once per request.
function getWindowBoundaries(): { todayIso: string; weekIso: string } {
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  // getUTCDay(): 0=Sunday, 1=Monday … 6=Saturday → days since Monday.
  const dayIndex = todayUtc.getUTCDay();
  const daysSinceMonday = dayIndex === 0 ? 6 : dayIndex - 1;
  const monday = new Date(todayUtc);
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  return { todayIso: todayUtc.toISOString(), weekIso: monday.toISOString() };
}

async function getDashboardStats() {
  const admin = createAdminClient();
  const { todayIso, weekIso } = getWindowBoundaries();

  const [
    drsTotal,
    drsToday,
    consultsTotal,
    consultsToday,
    trendsTotal,
    trendsToday,
    usersTotalRes,
    usersAllRes,
    subsTotal,
    subsThisWeek,
  ] = await Promise.all([
    admin
      .from("expert_picks")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    admin
      .from("expert_picks")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("created_at", todayIso),
    admin
      .from("consults")
      .select("id", { count: "exact", head: true })
      .eq("visibility", "public"),
    admin
      .from("consults")
      .select("id", { count: "exact", head: true })
      .eq("visibility", "public")
      .gte("created_at", todayIso),
    admin
      .from("trend_topics")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    admin
      .from("trend_topics")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("created_at", todayIso),
    admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("email_subscribers")
      .select("id", { count: "exact", head: true })
      .is("unsubscribed_at", null),
    admin
      .from("email_subscribers")
      .select("id", { count: "exact", head: true })
      .is("unsubscribed_at", null)
      .gte("created_at", weekIso),
  ]);

  // `total` is present on the success union but not on the error union, so
  // narrow via `in` before reading.
  const totalData = usersTotalRes.data;
  const totalUsers =
    totalData && "total" in totalData ? totalData.total : 0;

  const allUsers = usersAllRes.data;
  const usersList = allUsers && "users" in allUsers ? allUsers.users : [];
  const usersThisWeek = usersList.filter((u) => {
    if (!u.created_at) return false;
    return u.created_at >= weekIso;
  }).length;

  return {
    drsAnalysisToday: drsToday.count ?? 0,
    drsAnalysisTotal: drsTotal.count ?? 0,
    publicConsultToday: consultsToday.count ?? 0,
    publicConsultTotal: consultsTotal.count ?? 0,
    trendingArticleToday: trendsToday.count ?? 0,
    trendingArticleTotal: trendsTotal.count ?? 0,
    usersThisWeek,
    totalUsers,
    subscribersThisWeek: subsThisWeek.count ?? 0,
    subscribersTotal: subsTotal.count ?? 0,
  };
}

export default async function DashboardPage() {
  const [stats, recommendationsSummary] = await Promise.all([
    getDashboardStats(),
    getRecommendationsSummary(),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Content + audience stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <RatioCard
          title="Dr.'s Analysis"
          numerator={stats.drsAnalysisToday}
          denominator={stats.drsAnalysisTotal}
          numeratorLabel="today"
          denominatorLabel="published"
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        <RatioCard
          title="Consult Articles"
          numerator={stats.publicConsultToday}
          denominator={stats.publicConsultTotal}
          numeratorLabel="today"
          denominatorLabel="public"
          icon={
            <MessageCircleQuestion className="h-4 w-4 text-muted-foreground" />
          }
        />
        <RatioCard
          title="Articles"
          numerator={stats.trendingArticleToday}
          denominator={stats.trendingArticleTotal}
          numeratorLabel="today"
          denominatorLabel="Worth the Hype"
          icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
        />
        <RatioCard
          title="Registered Users"
          numerator={stats.usersThisWeek}
          denominator={stats.totalUsers}
          numeratorLabel="this week"
          denominatorLabel="total"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <RatioCard
          title="Subscribers"
          numerator={stats.subscribersThisWeek}
          denominator={stats.subscribersTotal}
          numeratorLabel="this week"
          denominatorLabel="active"
          icon={<AtSign className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Visitor & conversion analytics (date-range driven) */}
      <DashboardAnalytics
        recommendedProductCount={recommendationsSummary.uniqueProductCount}
      />
    </div>
  );
}

function RatioCard({
  title,
  numerator,
  denominator,
  numeratorLabel,
  denominatorLabel,
  icon,
}: {
  title: string;
  numerator: number;
  denominator: number;
  numeratorLabel: string;
  denominatorLabel: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">
            {numerator.toLocaleString()}
          </span>
          <span className="text-lg text-muted-foreground">/</span>
          <span className="text-lg font-medium text-muted-foreground">
            {denominator.toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {numeratorLabel} / {denominatorLabel}
        </p>
      </CardContent>
    </Card>
  );
}

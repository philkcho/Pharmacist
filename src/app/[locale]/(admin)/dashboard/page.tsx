import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, MessageCircleQuestion, Users, UserPlus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardAnalytics } from "./dashboard-analytics";

async function getDashboardStats() {
  const admin = createAdminClient();

  // New signups window: last 7 days (matches the default analytics preset)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  const [drsAnalysis, publicConsults, usersTotalRes, usersAllRes] =
    await Promise.all([
      // Dr.'s Analysis surfaced on homepage = published expert_picks
      admin
        .from("expert_picks")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      // Consult articles surfaced on homepage = public consults
      admin
        .from("consults")
        .select("id", { count: "exact", head: true })
        .eq("visibility", "public"),
      // Total registered users via auth admin API — perPage:1 just to get `total`
      admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
      // All users so we can count recent signups in-memory
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

  // `total` is present on the success union but not on the error union, so
  // narrow via `in` before reading.
  const totalData = usersTotalRes.data;
  const totalUsers =
    totalData && "total" in totalData ? totalData.total : 0;

  const allUsers = usersAllRes.data;
  const usersList = allUsers && "users" in allUsers ? allUsers.users : [];
  const newUsers = usersList.filter((u) => {
    if (!u.created_at) return false;
    return u.created_at >= sevenDaysAgoIso;
  }).length;

  return {
    drsAnalysisCount: drsAnalysis.count ?? 0,
    publicConsultCount: publicConsults.count ?? 0,
    totalUsers,
    newUsers,
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Content + audience stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Dr.'s Analysis"
          value={stats.drsAnalysisCount}
          sub="published"
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Consult Articles"
          value={stats.publicConsultCount}
          sub="public Q&A"
          icon={
            <MessageCircleQuestion className="h-4 w-4 text-muted-foreground" />
          }
        />
        <StatCard
          title="Registered Users"
          value={stats.totalUsers}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="New Sign-ups"
          value={stats.newUsers}
          sub="last 7 days"
          icon={<UserPlus className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Visitor & conversion analytics (date-range driven) */}
      <DashboardAnalytics />
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

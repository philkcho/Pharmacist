import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, FolderOpen, Pill, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

async function getDashboardStats() {
  const supabase = await createClient();

  const [articles, published, categories, medications, views] =
    await Promise.all([
      supabase.from("articles").select("id", { count: "exact", head: true }),
      supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      supabase
        .from("categories")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("medications")
        .select("id", { count: "exact", head: true }),
      supabase.from("articles").select("view_count"),
    ]);

  const totalViews =
    views.data?.reduce((sum, a) => sum + (a.view_count ?? 0), 0) ?? 0;

  return {
    totalArticles: articles.count ?? 0,
    publishedArticles: published.count ?? 0,
    totalCategories: categories.count ?? 0,
    totalMedications: medications.count ?? 0,
    totalViews,
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Articles
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalArticles}</div>
            <p className="text-xs text-muted-foreground">
              {stats.publishedArticles} published
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCategories}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Medications</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMedications}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

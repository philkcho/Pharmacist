import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, ExternalLink } from "lucide-react";
import { getArticles } from "@/lib/actions/articles";

const statusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  published: "default",
  draft: "secondary",
  in_review: "outline",
  archived: "destructive",
};

export default async function ArticlesPage() {
  const articles = await getArticles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Articles</h1>
        <Button render={<Link href="/articles/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          New Article
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Views</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((article) => (
              <TableRow key={article.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/${article.slug}`}
                    className="hover:underline"
                    target="_blank"
                  >
                    {article.title}
                    <ExternalLink className="ml-1 inline h-3 w-3 text-muted-foreground" />
                  </Link>
                </TableCell>
                <TableCell>{article.category?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[article.status] ?? "secondary"}>
                    {article.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {article.published_at
                    ? new Date(article.published_at).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>{article.view_count}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/articles/${article.id}/edit`} />}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {articles.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No articles yet. Create your first article.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

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
import { Plus } from "lucide-react";

// TODO: Replace with real data from Supabase
const mockArticles = [
  {
    id: 1,
    title: "Best Antihistamines for Seasonal Allergies",
    slug: "best-antihistamines-seasonal-allergies",
    status: "published" as const,
    category: "Allergy",
    publishedAt: "2026-04-01",
    viewCount: 0,
  },
  {
    id: 2,
    title: "Ibuprofen vs Acetaminophen: A Pharmacist's Guide",
    slug: "ibuprofen-vs-acetaminophen",
    status: "draft" as const,
    category: "Pain Relief",
    publishedAt: null,
    viewCount: 0,
  },
];

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  published: "default",
  draft: "secondary",
  in_review: "outline",
  archived: "destructive",
};

export default function ArticlesPage() {
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
            {mockArticles.map((article) => (
              <TableRow key={article.id}>
                <TableCell className="font-medium">{article.title}</TableCell>
                <TableCell>{article.category}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[article.status]}>
                    {article.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {article.publishedAt ?? "—"}
                </TableCell>
                <TableCell>{article.viewCount}</TableCell>
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
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

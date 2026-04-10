"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArticleEditor } from "@/components/editor/plate-editor";
import { ArrowLeft, Save, Eye, Trash2 } from "lucide-react";
import Link from "next/link";

// TODO: Load from Supabase
const categories = [
  { id: 1, name: "Pain Relief", slug: "pain-relief" },
  { id: 2, name: "Cold & Flu", slug: "cold-flu" },
  { id: 3, name: "Digestive Health", slug: "digestive-health" },
  { id: 4, name: "Allergy", slug: "allergy" },
  { id: 5, name: "Vitamins & Supplements", slug: "vitamins-supplements" },
  { id: 6, name: "Skin Care", slug: "skin-care" },
  { id: 7, name: "Sleep & Relaxation", slug: "sleep-relaxation" },
  { id: 8, name: "First Aid", slug: "first-aid" },
];

export default function EditArticlePage() {
  const params = useParams();
  const articleId = params.id as string;

  // TODO: Load article data from Supabase
  const [title, setTitle] = useState("Best Antihistamines for Seasonal Allergies");
  const [slug, setSlug] = useState("best-antihistamines-seasonal-allergies");
  const [excerpt, setExcerpt] = useState(
    "A pharmacist's guide to choosing the right antihistamine for your allergy symptoms."
  );
  const [categoryId, setCategoryId] = useState("4");
  const [status, setStatus] = useState<string>("draft");
  const [content, setContent] = useState(
    "Seasonal allergies affect millions of people every year. As a pharmacist, I frequently help patients navigate the wide range of over-the-counter antihistamine options available."
  );
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const handleSave = async (newStatus?: string) => {
    const article = {
      id: articleId,
      title,
      slug,
      excerpt,
      content,
      categoryId: categoryId ? parseInt(categoryId) : null,
      seoTitle: seoTitle || title,
      seoDescription: seoDescription || excerpt,
      status: newStatus || status,
    };
    console.log("Updating article:", article);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" render={<Link href="/articles" />}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Edit Article</h1>
          <Badge variant={status === "published" ? "default" : "secondary"}>
            {status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave("draft")}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          {status !== "published" && (
            <Button size="sm" onClick={() => handleSave("published")}>
              <Eye className="mr-2 h-4 w-4" />
              Publish
            </Button>
          )}
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Content */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Body</Label>
                <ArticleEditor initialValue={content} onChange={setContent} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seoTitle">SEO Title</Label>
                <Input
                  id="seoTitle"
                  placeholder={title || "SEO title..."}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {(seoTitle || title).length}/60 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoDescription">Meta Description</Label>
                <Textarea
                  id="seoDescription"
                  placeholder={excerpt || "Meta description..."}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {(seoDescription || excerpt).length}/160 characters
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

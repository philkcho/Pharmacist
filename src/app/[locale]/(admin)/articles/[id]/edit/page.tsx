"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  Save,
  Eye,
  Trash2,
  Sparkles,
  Loader2,
  Plus,
  X,
  Upload,
  Link as LinkIcon,
  Package,
} from "lucide-react";
import Link from "next/link";

interface Reference {
  url: string;
  title: string;
  sourceType: "pubmed" | "fda" | "cdc" | "who" | "other";
}

interface ProductCard {
  name: string;
  genericName: string;
  pros: string[];
  cons: string[];
  verdict: string;
  recommended: boolean;
}

const categories = [
  { id: 1, name: "Pain Relief" },
  { id: 2, name: "Cold & Flu" },
  { id: 3, name: "Digestive Health" },
  { id: 4, name: "Allergy" },
  { id: 5, name: "Vitamins & Supplements" },
  { id: 6, name: "Skin Care" },
  { id: 7, name: "Sleep & Relaxation" },
  { id: 8, name: "First Aid" },
];

const sourceTypes = [
  { value: "pubmed", label: "PubMed" },
  { value: "fda", label: "FDA" },
  { value: "cdc", label: "CDC" },
  { value: "who", label: "WHO" },
  { value: "other", label: "Other" },
];

export default function EditArticlePage() {
  const params = useParams();
  const router = useRouter();
  const articleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("draft");
  const [content, setContent] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [references, setReferences] = useState<Reference[]>([]);
  const [productCards, setProductCards] = useState<ProductCard[]>([]);

  // AI Enhance
  const [enhancePrompt, setEnhancePrompt] = useState("");
  const [enhancing, setEnhancing] = useState(false);

  // Image upload
  const [uploading, setUploading] = useState(false);

  // AI Auto-extract
  const [extractingRefs, setExtractingRefs] = useState(false);
  const [extractingProducts, setExtractingProducts] = useState(false);

  // 기사 데이터 로드
  useEffect(() => {
    async function loadArticle() {
      try {
        const res = await fetch(`/api/articles/${articleId}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setTitle(data.title ?? "");
        setSlug(data.slug ?? "");
        setExcerpt(data.excerpt ?? "");
        setCategoryId(data.category_id ? String(data.category_id) : "");
        setStatus(data.status ?? "draft");
        setContent(typeof data.content === "string" ? data.content : JSON.stringify(data.content));
        setSeoTitle(data.seo_title ?? "");
        setSeoDescription(data.seo_description ?? "");
        setReferences(data.article_references ?? []);
        setProductCards(data.product_cards ?? []);
      } catch {
        alert("Article not found");
        router.push("/articles");
      } finally {
        setLoading(false);
      }
    }
    loadArticle();
  }, [articleId, router]);

  // 저장
  const handleSave = async (newStatus?: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          excerpt,
          content,
          status: newStatus || status,
          category_id: categoryId ? parseInt(categoryId) : null,
          seo_title: seoTitle || title,
          seo_description: seoDescription || excerpt,
          references,
          product_cards: productCards,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }
      if (newStatus) setStatus(newStatus);
      alert("Saved successfully");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this article?")) return;
    const res = await fetch(`/api/articles/${articleId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/articles");
    }
  };

  // AI Enhance
  const handleEnhance = useCallback(async () => {
    if (!enhancePrompt.trim() || !content.trim()) return;
    setEnhancing(true);
    try {
      const res = await fetch("/api/ai/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, instruction: enhancePrompt }),
      });
      if (!res.ok) throw new Error("Enhancement failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setContent(text);
        }
      }
      setEnhancePrompt("");
    } catch {
      alert("Enhancement failed");
    } finally {
      setEnhancing(false);
    }
  }, [content, enhancePrompt]);

  // 이미지 업로드
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", `articles/${slug || "draft"}`);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setContent((prev) => prev + `\n\n![${file.name}](${url})\n`);
    } catch {
      alert("Image upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // AI Auto-extract References
  const extractReferences = async () => {
    if (!content.trim()) return;
    setExtractingRefs(true);
    try {
      const res = await fetch("/api/ai/extract-references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      setReferences(data.references ?? []);
    } catch {
      alert("Failed to extract references");
    } finally {
      setExtractingRefs(false);
    }
  };

  // AI Auto-extract Product Cards
  const extractProducts = async () => {
    if (!content.trim()) return;
    setExtractingProducts(true);
    try {
      const res = await fetch("/api/ai/extract-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      setProductCards(data.products ?? []);
    } catch {
      alert("Failed to extract products");
    } finally {
      setExtractingProducts(false);
    }
  };

  // 참고 논문 추가/삭제
  const addReference = () =>
    setReferences([...references, { url: "", title: "", sourceType: "other" }]);
  const removeReference = (i: number) =>
    setReferences(references.filter((_, idx) => idx !== i));
  const updateReference = (i: number, field: keyof Reference, value: string) =>
    setReferences(references.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  // 제품 카드 추가/삭제
  const addProductCard = () =>
    setProductCards([
      ...productCards,
      { name: "", genericName: "", pros: [""], cons: [""], verdict: "", recommended: true },
    ]);
  const removeProductCard = (i: number) =>
    setProductCards(productCards.filter((_, idx) => idx !== i));
  const updateProductCard = (i: number, field: string, value: unknown) =>
    setProductCards(productCards.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <Button variant="outline" size="sm" onClick={() => handleSave()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
          {status !== "published" && (
            <Button size="sm" onClick={() => handleSave("published")} disabled={saving}>
              <Eye className="mr-2 h-4 w-4" />
              Publish
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Title / Slug / Excerpt */}
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="min-w-64">
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea id="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* Body Editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Body (Markdown)</CardTitle>
                <div className="flex gap-2">
                  <label>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <Button variant="outline" size="sm" disabled={uploading} onClick={(e) => {
                      const input = (e.currentTarget as HTMLElement).closest("label")?.querySelector("input");
                      input?.click();
                    }}>
                      <Upload className="mr-2 h-4 w-4" />
                      {uploading ? "Uploading..." : "Image"}
                    </Button>
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[500px] font-mono text-sm"
              />
            </CardContent>
          </Card>

          {/* AI Enhance */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Enhance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder='e.g. "Add a comparison table for the top 3 products", "Expand the dosing section", "Add drug interaction warnings"'
                value={enhancePrompt}
                onChange={(e) => setEnhancePrompt(e.target.value)}
                rows={3}
              />
              <Button
                onClick={handleEnhance}
                disabled={enhancing || !enhancePrompt.trim() || !content.trim()}
                className="w-full"
              >
                {enhancing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Enhance with AI
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                AI will modify the article body based on your instruction. The full content will be replaced.
              </p>
            </CardContent>
          </Card>

          {/* References */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  References & Sources
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={extractReferences}
                    disabled={extractingRefs}
                  >
                    {extractingRefs ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Auto-fill
                  </Button>
                  <Button variant="outline" size="sm" onClick={addReference}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {references.length === 0 && (
                <p className="text-sm text-muted-foreground">No references added yet. Add links to PubMed studies, FDA guidelines, etc.</p>
              )}
              {references.map((ref, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium">Reference {i + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeReference(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Title — e.g. Efficacy of Benzoyl Peroxide in Acne Treatment"
                    value={ref.title}
                    onChange={(e) => updateReference(i, "title", e.target.value)}
                  />
                  <Input
                    placeholder="URL — e.g. https://pubmed.ncbi.nlm.nih.gov/..."
                    value={ref.url}
                    onChange={(e) => updateReference(i, "url", e.target.value)}
                  />
                  <Select value={ref.sourceType} onValueChange={(v) => v && updateReference(i, "sourceType", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-48">
                      {sourceTypes.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Product Analysis Cards */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Product Analysis Cards
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={extractProducts}
                    disabled={extractingProducts}
                  >
                    {extractingProducts ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Auto-fill
                  </Button>
                  <Button variant="outline" size="sm" onClick={addProductCard}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {productCards.length === 0 && (
                <p className="text-sm text-muted-foreground">No products added yet. Add medications with pros, cons, and your verdict.</p>
              )}
              {productCards.map((card, i) => (
                <div key={i} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium">Product {i + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeProductCard(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Brand name — e.g. Tylenol"
                      value={card.name}
                      onChange={(e) => updateProductCard(i, "name", e.target.value)}
                    />
                    <Input
                      placeholder="Generic name — e.g. Acetaminophen"
                      value={card.genericName}
                      onChange={(e) => updateProductCard(i, "genericName", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-green-600">Pros (one per line)</Label>
                      <Textarea
                        rows={3}
                        placeholder={"Fast-acting\nWidely available\nGentle on stomach"}
                        value={card.pros.join("\n")}
                        onChange={(e) => updateProductCard(i, "pros", e.target.value.split("\n"))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-red-600">Cons (one per line)</Label>
                      <Textarea
                        rows={3}
                        placeholder={"Liver risk at high doses\nNo anti-inflammatory effect"}
                        value={card.cons.join("\n")}
                        onChange={(e) => updateProductCard(i, "cons", e.target.value.split("\n"))}
                      />
                    </div>
                  </div>
                  <Textarea
                    placeholder="Pharmacist's verdict — e.g. Best first-line option for mild pain and fever..."
                    value={card.verdict}
                    onChange={(e) => updateProductCard(i, "verdict", e.target.value)}
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`recommended-${i}`}
                      checked={card.recommended}
                      onChange={(e) => updateProductCard(i, "recommended", e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`recommended-${i}`} className="text-sm">
                      Recommended by AI PharmCare
                    </Label>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
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
                  {(seoTitle || title).length}/60
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
                  {(seoDescription || excerpt).length}/160
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <Button
                onClick={() => handleSave("published")}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                Publish Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  Sparkles,
  Save,
  Eye,
  Loader2,
  RotateCcw,
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

const sourceTypes = [
  { value: "pubmed", label: "PubMed" },
  { value: "fda", label: "FDA" },
  { value: "cdc", label: "CDC" },
  { value: "who", label: "WHO" },
  { value: "other", label: "Other" },
];

const categories = [
  { id: 1, name: "Pain Relief", slug: "pain-relief" },
  { id: 2, name: "Cold & Flu", slug: "cold-flu" },
  { id: 3, name: "Digestive Health", slug: "digestive-health" },
  { id: 4, name: "Allergy", slug: "allergy" },
  { id: 5, name: "Vitamins & Supplements", slug: "vitamins-supplements" },
  { id: 6, name: "Skin Care & Beauty", slug: "skin-care-beauty" },
  { id: 7, name: "Sleep & Relaxation", slug: "sleep-relaxation" },
  { id: 8, name: "First Aid", slug: "first-aid" },
];

const articleTypes = [
  { value: "best-of", label: "Best X for Y" },
  { value: "comparison", label: "Drug vs Drug Comparison" },
  { value: "guide", label: "Complete Guide" },
  { value: "safety", label: "Safety & Interactions" },
  { value: "seasonal", label: "Seasonal Recommendation" },
];

export default function GenerateArticlePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [articleType, setArticleType] = useState("");
  const [medicationsInput, setMedicationsInput] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [saving, setSaving] = useState(false);
  const [editedContent, setEditedContent] = useState<string | null>(null);

  const [completion, setCompletion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 추가 기능 상태
  const [references, setReferences] = useState<Reference[]>([]);
  const [productCards, setProductCards] = useState<ProductCard[]>([]);
  const [enhancePrompt, setEnhancePrompt] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractingRefs, setExtractingRefs] = useState(false);
  const [extractingProducts, setExtractingProducts] = useState(false);

  const categoryName =
    categories.find((c) => String(c.id) === categoryId)?.name ?? "";

  const generateSlug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      alert("Please enter a topic");
      return;
    }

    setEditedContent(null);
    setCompletion("");
    setIsLoading(true);

    // Auto-generate title and slug from topic
    const autoTitle = topic.endsWith("?") || topic.endsWith(".")
      ? topic
      : `${topic}: A Pharmacist's Guide`;
    setTitle(autoTitle);
    setSlug(generateSlug(autoTitle));

    try {
      const medications = medicationsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          category: categoryName,
          articleType:
            articleTypes.find((t) => t.value === articleType)?.label ?? "guide",
          medications,
        }),
      });

      if (!res.ok) throw new Error("Generation failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setCompletion(text);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsLoading(false);
    }
  }, [topic, categoryName, articleType, medicationsInput]);

  const handleSave = async (status: "draft" | "published") => {
    if (!title.trim() || !(editedContent ?? completion)) {
      alert("Title and content are required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug: slug || generateSlug(title),
          excerpt:
            excerpt ||
            (editedContent ?? completion).slice(0, 200).replace(/[#*\n]/g, "").trim(),
          content: editedContent ?? completion,
          category_id: categoryId ? parseInt(categoryId) : null,
          seo_title: title,
          seo_description:
            excerpt ||
            (editedContent ?? completion).slice(0, 160).replace(/[#*\n]/g, "").trim(),
          status,
          is_ai_drafted: true,
          ai_model: "gemini-2.5-pro",
          references,
          product_cards: productCards,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      router.push("/articles");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // AI Enhance
  const handleEnhance = useCallback(async () => {
    const current = editedContent ?? completion;
    if (!enhancePrompt.trim() || !current.trim()) return;
    setEnhancing(true);
    try {
      const res = await fetch("/api/ai/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: current, instruction: enhancePrompt }),
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
          setEditedContent(text);
        }
      }
      setEnhancePrompt("");
    } catch {
      alert("Enhancement failed");
    } finally {
      setEnhancing(false);
    }
  }, [enhancePrompt, editedContent, completion]);

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
      const current = editedContent ?? completion;
      setEditedContent(current + `\n\n![${file.name}](${url})\n`);
    } catch {
      alert("Image upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // AI Auto-extract References
  const extractReferences = async () => {
    const current = editedContent ?? completion;
    if (!current.trim()) return;
    setExtractingRefs(true);
    try {
      const res = await fetch("/api/ai/extract-references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      setReferences(data.references ?? []);
    } catch (err) {
      console.error("[extract-references] client error:", err);
      alert(
        `Failed to extract references: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setExtractingRefs(false);
    }
  };

  // AI Auto-extract Product Cards
  const extractProducts = async () => {
    const current = editedContent ?? completion;
    if (!current.trim()) return;
    setExtractingProducts(true);
    try {
      const res = await fetch("/api/ai/extract-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      setProductCards(data.products ?? []);
    } catch (err) {
      console.error("[extract-products] client error:", err);
      alert(
        `Failed to extract products: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setExtractingProducts(false);
    }
  };

  // References CRUD
  const addReference = () =>
    setReferences([...references, { url: "", title: "", sourceType: "other" }]);
  const removeReference = (i: number) =>
    setReferences(references.filter((_, idx) => idx !== i));
  const updateReference = (i: number, field: keyof Reference, value: string) =>
    setReferences(references.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  // Product Cards CRUD
  const addProductCard = () =>
    setProductCards([
      ...productCards,
      { name: "", genericName: "", pros: [""], cons: [""], verdict: "", recommended: true },
    ]);
  const removeProductCard = (i: number) =>
    setProductCards(productCards.filter((_, idx) => idx !== i));
  const updateProductCard = (i: number, field: string, value: unknown) =>
    setProductCards(productCards.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

  const currentContent = editedContent ?? completion;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" render={<Link href="/articles" />}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Generate Article with AI</h1>
        </div>
        {currentContent && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave("draft")}
              disabled={saving}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            <Button onClick={() => handleSave("published")} disabled={saving}>
              <Eye className="mr-2 h-4 w-4" />
              Publish Now
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div className="space-y-6">
          {/* Generation Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Article Generator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic / Title Idea</Label>
                <Input
                  id="topic"
                  placeholder='e.g. "Best OTC acne treatments for teenagers" or "Melatonin vs Diphenhydramine for sleep"'
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={categoryId}
                    onValueChange={(v) => v && setCategoryId(v)}
                  >
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

                <div className="space-y-2">
                  <Label>Article Type</Label>
                  <Select
                    value={articleType}
                    onValueChange={(v) => v && setArticleType(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="min-w-64">
                      {articleTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="medications">
                  Medications{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional — comma separated; pulls FDA label data)
                  </span>
                </Label>
                <Input
                  id="medications"
                  placeholder='e.g. "Tylenol, Advil, Aleve"'
                  value={medicationsInput}
                  onChange={(e) => setMedicationsInput(e.target.value)}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isLoading || !topic.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating article...
                  </>
                ) : currentContent ? (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Article
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Content */}
          {(currentContent || isLoading) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated Content</CardTitle>
                  {currentContent && !isLoading && (
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={(e) => {
                          const input = (e.currentTarget as HTMLElement)
                            .closest("label")
                            ?.querySelector("input");
                          input?.click();
                        }}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {uploading ? "Uploading..." : "Image"}
                      </Button>
                    </label>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={editedContent ?? completion}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[500px] font-mono text-sm"
                  placeholder={isLoading ? "AI is writing..." : ""}
                  readOnly={isLoading}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  You can edit the generated content above before saving.
                  Markdown formatting is supported.
                </p>
              </CardContent>
            </Card>
          )}

          {/* AI Enhance */}
          {currentContent && !isLoading && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Enhance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder='e.g. "Add a comparison table for the top 3 products", "Expand the dosing section"'
                  value={enhancePrompt}
                  onChange={(e) => setEnhancePrompt(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleEnhance}
                  disabled={enhancing || !enhancePrompt.trim()}
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
              </CardContent>
            </Card>
          )}

          {/* References */}
          {currentContent && !isLoading && (
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
                  <p className="text-sm text-muted-foreground">
                    No references added yet. Add links to PubMed, FDA, etc.
                  </p>
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
                      placeholder="Title"
                      value={ref.title}
                      onChange={(e) => updateReference(i, "title", e.target.value)}
                    />
                    <Input
                      placeholder="URL"
                      value={ref.url}
                      onChange={(e) => updateReference(i, "url", e.target.value)}
                    />
                    <Select
                      value={ref.sourceType}
                      onValueChange={(v) => v && updateReference(i, "sourceType", v)}
                    >
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
          )}

          {/* Product Cards */}
          {currentContent && !isLoading && (
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
                      Add
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {productCards.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No products added yet.
                  </p>
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
                        placeholder="Brand name"
                        value={card.name}
                        onChange={(e) => updateProductCard(i, "name", e.target.value)}
                      />
                      <Input
                        placeholder="Generic name"
                        value={card.genericName}
                        onChange={(e) => updateProductCard(i, "genericName", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs text-green-600">Pros</Label>
                        <Textarea
                          rows={3}
                          value={card.pros.join("\n")}
                          onChange={(e) => updateProductCard(i, "pros", e.target.value.split("\n"))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-red-600">Cons</Label>
                        <Textarea
                          rows={3}
                          value={card.cons.join("\n")}
                          onChange={(e) => updateProductCard(i, "cons", e.target.value.split("\n"))}
                        />
                      </div>
                    </div>
                    <Textarea
                      placeholder="Pharmacist's verdict"
                      value={card.verdict}
                      onChange={(e) => updateProductCard(i, "verdict", e.target.value)}
                      rows={2}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`gen-recommended-${i}`}
                        checked={card.recommended}
                        onChange={(e) => updateProductCard(i, "recommended", e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`gen-recommended-${i}`} className="text-sm">
                        Recommended
                      </Label>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {currentContent && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Article Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setSlug(generateSlug(e.target.value));
                      }}
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
                      placeholder="Auto-generated from content if left empty"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium">Quick Publish</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Review the content and click below to publish directly to
                    the homepage.
                  </p>
                  <Button
                    onClick={() => handleSave("published")}
                    disabled={saving}
                    className="mt-4 w-full"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    Publish to Homepage
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

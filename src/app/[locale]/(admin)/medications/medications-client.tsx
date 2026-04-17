"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Loader2,
  Database,
  Cloud,
  Image as ImageIcon,
  PackagePlus,
} from "lucide-react";
import {
  createMedication,
  updateMedication,
  deleteMedication,
  previewMedicationFromFda,
  generateMissingProductImages,
  importSampleProducts,
} from "@/lib/actions/medications";

interface Medication {
  id: number;
  name: string;
  slug: string;
  generic_name: string | null;
  brand_names: string[] | null;
  category_id: number | null;
  is_otc: boolean;
  category: { name: string } | null;
}

interface FdaPreview {
  id: number;
  name: string;
  slug: string;
  generic_name: string | null;
  brand_names: string[] | null;
  description: string | null;
  active_ingredients: unknown;
  dosage_forms: string[] | null;
  warnings: string | null;
  side_effects: string | null;
  is_otc: boolean;
  fda_spl_id: string | null;
  last_synced_at: string | null;
  source: string;
}

type PreviewResult =
  | {
      ok: true;
      source: "cache" | "fda";
      medication: FdaPreview;
      error?: undefined;
    }
  | {
      ok: false;
      source: "cache" | "fda" | "none";
      medication: FdaPreview | null;
      error?: string;
    };

interface Category {
  id: number;
  name: string;
}

export function MedicationsClient({
  initialMedications,
  categories,
}: {
  initialMedications: Medication[];
  categories: Category[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [genericName, setGenericName] = useState("");
  const [brandNames, setBrandNames] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);

  // FDA preview state
  const [fdaSearchTerm, setFdaSearchTerm] = useState("");
  const [fdaResult, setFdaResult] = useState<PreviewResult | null>(null);
  const [fdaPending, startFdaTransition] = useTransition();

  // Image generation state
  const [imageGenPending, startImageGenTransition] = useTransition();
  const [imageGenResult, setImageGenResult] = useState<string | null>(null);

  const handleGenerateImages = () => {
    if (!confirm("Generate AI images for products without images? This may take a minute.")) return;
    startImageGenTransition(async () => {
      setImageGenResult(null);
      const result = await generateMissingProductImages();
      setImageGenResult(result.message);
      if (result.generated > 0) router.refresh();
    });
  };

  const [importPending, startImportTransition] = useTransition();
  const handleImportSamples = () => {
    if (
      !confirm(
        "Import sample products from topics data? This generates AI analysis + images for each. May take several minutes."
      )
    )
      return;
    startImportTransition(async () => {
      setImageGenResult(null);
      const result = await importSampleProducts();
      setImageGenResult(result.message);
      if (result.imported > 0) router.refresh();
    });
  };

  const handleFdaFetch = () => {
    if (!fdaSearchTerm.trim()) return;
    startFdaTransition(async () => {
      const result = (await previewMedicationFromFda(
        fdaSearchTerm
      )) as PreviewResult;
      setFdaResult(result);
      if (result.ok && result.source === "fda") {
        // A new row was upserted — refresh the server-loaded table below
        router.refresh();
      }
    });
  };

  const generateSlug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const handleOpenNew = () => {
    setEditingMed(null);
    setName("");
    setSlug("");
    setGenericName("");
    setBrandNames("");
    setCategoryId("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (med: Medication) => {
    setEditingMed(med);
    setName(med.name);
    setSlug(med.slug);
    setGenericName(med.generic_name ?? "");
    setBrandNames(med.brand_names?.join(", ") ?? "");
    setCategoryId(med.category_id ? String(med.category_id) : "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const formData = {
      name,
      slug,
      generic_name: genericName,
      brand_names: brandNames
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean),
      category_id: categoryId ? parseInt(categoryId) : null,
      is_otc: true,
    };

    try {
      if (editingMed) {
        await updateMedication(editingMed.id, formData);
      } else {
        await createMedication(formData);
      }
      setDialogOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteMedication(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Medications</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleImportSamples}
            disabled={importPending}
          >
            {importPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PackagePlus className="mr-2 h-4 w-4" />
            )}
            Import Samples
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateImages}
            disabled={imageGenPending}
          >
            {imageGenPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="mr-2 h-4 w-4" />
            )}
            Refresh Images
          </Button>
          <Button onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add Medication
          </Button>
        </div>
      </div>

      {imageGenResult && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
          {imageGenResult}
        </div>
      )}

      {/* FDA fetch utility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-primary" />
            Fetch from FDA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder='Enter a brand or generic name (e.g. "Tylenol", "Ibuprofen")'
              value={fdaSearchTerm}
              onChange={(e) => setFdaSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleFdaFetch();
              }}
              disabled={fdaPending}
            />
            <Button
              onClick={handleFdaFetch}
              disabled={fdaPending || !fdaSearchTerm.trim()}
              className="shrink-0"
            >
              {fdaPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Fetch
            </Button>
          </div>

          {fdaResult && (
            <FdaResultCard result={fdaResult} />
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Generic Name</TableHead>
              <TableHead>Brands</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialMedications.map((med) => (
              <TableRow key={med.id}>
                <TableCell className="font-medium">{med.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {med.generic_name}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {med.brand_names?.map((brand) => (
                      <Badge key={brand} variant="secondary">
                        {brand}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{med.category?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={med.is_otc ? "default" : "outline"}>
                    {med.is_otc ? "OTC" : "Rx"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleOpenEdit(med)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(med.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {initialMedications.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No medications yet. Add your first medication.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMed ? "Edit Medication" : "New Medication"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="medName">Name</Label>
              <Input
                id="medName"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingMed) setSlug(generateSlug(e.target.value));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medSlug">Slug</Label>
              <Input
                id="medSlug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medGeneric">Generic Name</Label>
              <Input
                id="medGeneric"
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medBrands">Brand Names (comma-separated)</Label>
              <Input
                id="medBrands"
                placeholder="Advil, Motrin"
                value={brandNames}
                onChange={(e) => setBrandNames(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={categoryId}
                onValueChange={(v) => v && setCategoryId(v)}
              >
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
            <Button onClick={handleSave} className="w-full" disabled={loading}>
              {loading ? "Saving..." : editingMed ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FdaResultCard({ result }: { result: PreviewResult }) {
  if (!result.ok || !result.medication) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {result.error ?? "No data found"}
      </div>
    );
  }

  const med = result.medication;
  const active = Array.isArray(med.active_ingredients)
    ? (med.active_ingredients as string[])
    : [];
  const isCache = result.source === "cache";

  return (
    <div className="space-y-4 rounded-md border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{med.name}</h3>
            <Badge
              variant={isCache ? "secondary" : "default"}
              className="gap-1"
            >
              {isCache ? (
                <Database className="h-3 w-3" />
              ) : (
                <Cloud className="h-3 w-3" />
              )}
              {isCache ? "DB cache" : "Fresh from FDA"}
            </Badge>
          </div>
          {med.generic_name && (
            <p className="text-sm text-muted-foreground">
              Generic: {med.generic_name}
            </p>
          )}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {med.fda_spl_id && (
            <div>
              SPL: <code className="font-mono">{med.fda_spl_id.slice(0, 8)}…</code>
            </div>
          )}
          {med.last_synced_at && (
            <div>
              Synced: {new Date(med.last_synced_at).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {active.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Active ingredients
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {active.map((a) => (
              <Badge key={a} variant="outline">
                {a}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {med.dosage_forms && med.dosage_forms.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dosage forms
          </p>
          <p className="mt-1 text-sm">{med.dosage_forms.join(", ")}</p>
        </div>
      )}

      {med.warnings && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
            FDA warnings ({med.warnings.length.toLocaleString()} chars)
          </summary>
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded border bg-background p-3 text-xs">
            {med.warnings}
          </p>
        </details>
      )}

      {med.side_effects && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
            Adverse reactions
          </summary>
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded border bg-background p-3 text-xs">
            {med.side_effects}
          </p>
        </details>
      )}
    </div>
  );
}

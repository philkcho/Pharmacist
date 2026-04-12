"use client";

import { useRef, useState, useTransition } from "react";
import {
  Search,
  Loader2,
  ShieldCheck,
  FileWarning,
  ExternalLink,
  MessageSquarePlus,
  CheckCircle2,
  Camera,
  X as XIcon,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  lookupProduct,
  requestPharmacistReview,
  type LookupResult,
  type LookupResultAiGenerated,
} from "@/lib/actions/lookup";
import type { ProductIdentification } from "@/lib/ai/identify-product";

const MAX_IMAGE_DIM = 1024; // px, longest edge
const JPEG_QUALITY = 0.85;

/**
 * Resize an image File on the client to max MAX_IMAGE_DIM on the longest
 * side, re-encode as JPEG. Canvas re-encoding also strips EXIF metadata
 * (no GPS / device info leaks to the server).
 */
async function resizeImageToBase64(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode image"));
    image.src = dataUrl;
  });

  const scale = Math.min(
    MAX_IMAGE_DIM / img.width,
    MAX_IMAGE_DIM / img.height,
    1
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const resizedDataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const base64 = resizedDataUrl.split(",")[1] ?? "";
  return { base64, mimeType: "image/jpeg" };
}

interface ImageLookupResponse {
  identification: ProductIdentification;
  lookupResult: LookupResult;
  error?: string;
}

/**
 * Product Lookup widget — the "wow moment" entry point on the home page.
 * Users can search by brand name, generic name, or active ingredient. Results
 * come from the DB-first → openFDA fallback pipeline (`getOrFetchMedication`).
 *
 * Result classification:
 *   - "pharmacist_reviewed" → green ShieldCheck, full trust
 *   - "fda_only" → blue FileWarning, FDA label data only
 *   - "miss" → gray empty state
 *
 * Sprint 2 MVP scope: text input only, no image upload, no rate limiting,
 * no caching beyond what the backend already provides.
 */
export function ProductLookup() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [identification, setIdentification] =
    useState<ProductIdentification | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetImageState = () => {
    setIdentification(null);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSearch = () => {
    const trimmed = query.trim();
    if (!trimmed || isPending) return;
    resetImageState();
    setError(null);
    startTransition(async () => {
      try {
        const data = await lookupProduct(trimmed);
        setResult(data);
      } catch (err) {
        console.error("[product-lookup] error:", err);
        setError(
          err instanceof Error ? err.message : "Something went wrong. Please try again."
        );
        setResult(null);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleImageSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || isPending) return;

    setError(null);
    setQuery("");

    // Immediate preview while the Gemini call runs.
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setIdentification(null);
    setResult(null);

    startTransition(async () => {
      try {
        const { base64, mimeType } = await resizeImageToBase64(file);
        const res = await fetch("/api/lookup/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = (await res.json()) as ImageLookupResponse;
        if (!res.ok) {
          throw new Error(data.error ?? "Image lookup failed");
        }
        setIdentification(data.identification);
        setResult(data.lookupResult);
      } catch (err) {
        console.error("[product-lookup] image error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't process that image. Please try again."
        );
      }
    });
  };

  const triggerImageInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-primary" />
          Look up any OTC product
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Search by brand, generic name, or active ingredient — or upload a
          photo of the package. Every result is linked to FDA drug-label data.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Tylenol, ibuprofen, Zyrtec…"
            disabled={isPending}
            aria-label="Product name"
          />
          <Button
            onClick={handleSearch}
            disabled={isPending || !query.trim()}
            className="shrink-0"
          >
            {isPending && query.trim() ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Look up</span>
          </Button>
        </div>

        {/* Photo upload CTA — separate row, always visible */}
        <div className="flex items-center justify-between gap-2 rounded-md border border-dashed bg-muted/30 p-2">
          <p className="pl-2 text-xs text-muted-foreground">
            Can&apos;t type the name? Upload a photo of the label.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={triggerImageInput}
            disabled={isPending}
            className="shrink-0"
          >
            {isPending && imagePreviewUrl ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            <span className="ml-2">Upload photo</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleImageSelected}
            className="hidden"
            aria-label="Upload product photo"
          />
        </div>

        {imagePreviewUrl && (
          <ImagePreviewCard
            previewUrl={imagePreviewUrl}
            identification={identification}
            isPending={isPending}
            onClear={() => {
              resetImageState();
              setResult(null);
            }}
          />
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && <LookupResultCard result={result} />}
      </CardContent>
    </Card>
  );
}

/**
 * Shows the uploaded image thumbnail, the AI's identification result,
 * and a clear button. Sits between the Lookup form and the result card.
 */
function ImagePreviewCard({
  previewUrl,
  identification,
  isPending,
  onClear,
}: {
  previewUrl: string;
  identification: ProductIdentification | null;
  isPending: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex gap-3 rounded-md border bg-card p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt="Uploaded product"
        className="h-20 w-20 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1 text-sm">
        {isPending && !identification ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Identifying product…
          </div>
        ) : identification ? (
          <>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                AI identification · {identification.confidence} confidence
              </span>
            </div>
            {identification.productName ? (
              <p className="mt-1 font-medium">{identification.productName}</p>
            ) : (
              <p className="mt-1 font-medium text-muted-foreground">
                Couldn&apos;t read the label clearly
              </p>
            )}
            {identification.reasoning && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {identification.reasoning}
              </p>
            )}
          </>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        disabled={isPending}
        aria-label="Clear uploaded image"
      >
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

function LookupResultCard({ result }: { result: LookupResult }) {
  if (result.type === "miss") {
    return (
      <div className="space-y-3 rounded-md border border-dashed bg-muted/30 p-4 text-sm">
        <div className="text-center text-muted-foreground">
          <p className="font-medium text-foreground">No results for “{result.query}”</p>
          <p className="mt-1">{result.message}</p>
        </div>
        {result.lookupId !== null && (
          <div className="flex justify-center">
            <RequestReviewButton
              lookupId={result.lookupId}
              queryText={result.query}
            />
          </div>
        )}
      </div>
    );
  }

  if (result.type === "ai_generated") {
    return <AiGeneratedResultCard result={result} />;
  }

  const { medication } = result;
  const isReviewed = result.type === "pharmacist_reviewed";

  return (
    <div className="rounded-md border bg-card p-4">
      {/* Trust badge */}
      <div className="mb-3 flex items-center gap-2">
        {isReviewed ? (
          <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700">
            <ShieldCheck className="h-3 w-3" />
            Pharmacist-reviewed
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <FileWarning className="h-3 w-3" />
            FDA label data · pending pharmacist review
          </Badge>
        )}
      </div>

      {/* Name + generic */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold leading-tight">{medication.name}</h3>
        {medication.genericName && (
          <p className="text-sm text-muted-foreground">
            Generic: <span className="font-medium">{medication.genericName}</span>
          </p>
        )}
        {medication.brandNames.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Also sold as: {medication.brandNames.join(", ")}
          </p>
        )}
      </div>

      {/* Description */}
      {medication.description && (
        <p className="mb-3 text-sm text-muted-foreground line-clamp-3">
          {medication.description}
        </p>
      )}

      {/* Active ingredients */}
      {medication.activeIngredients.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Active ingredients
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {medication.activeIngredients.slice(0, 8).map((ing) => (
              <Badge key={ing} variant="outline" className="text-xs font-normal">
                {ing}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Warnings (truncated) */}
      {medication.warnings && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            ⚠️ FDA warnings
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/90 line-clamp-4 dark:text-amber-200/90">
            {medication.warnings}
          </p>
        </div>
      )}

      {/* Source attribution */}
      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>
          Source: <span className="font-medium">{medication.source === "fda" ? "openFDA drug label" : "Pharmacist curated"}</span>
        </span>
        {medication.fdaSplId && (
          <a
            href={`https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${medication.fdaSplId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            View on DailyMed
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Review request CTA — only for unreviewed fda_only results */}
      {!isReviewed && result.lookupId !== null && (
        <div className="mt-3 border-t pt-3">
          <RequestReviewButton
            lookupId={result.lookupId}
            queryText={medication.name}
          />
        </div>
      )}
    </div>
  );
}

/**
 * "Request pharmacist review" CTA. Opens a dialog for optional email +
 * note, submits via `requestPharmacistReview` server action, and shows
 * a success state inline once accepted.
 */
function RequestReviewButton({
  lookupId,
  queryText,
}: {
  lookupId: number;
  queryText: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await requestPharmacistReview({
        lookupId,
        queryText,
        contactEmail: email.trim() || undefined,
        requesterNote: note.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSubmitted(true);
    });
  };

  if (submitted) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
        <CheckCircle2 className="h-4 w-4" />
        Thanks — a pharmacist will review this product.
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm">
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Request pharmacist review
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request pharmacist review</DialogTitle>
          <DialogDescription>
            Ask a licensed pharmacist to review <strong>“{queryText}”</strong> and
            add it to Dr.pharmacist. Email is optional — we&apos;ll only use it to
            notify you when the review is ready.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="review-email">Email (optional)</Label>
            <Input
              id="review-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-note">What would you like to know? (optional)</Label>
            <Textarea
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Is this safe with high blood pressure?"
              rows={3}
              disabled={isPending}
              maxLength={1000}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * AI-generated fallback result card. Rendered when the DB + openFDA
 * pipeline both miss but Gemini was able to produce an analysis.
 *
 * MUST remain visually distinct from pharmacist-reviewed and FDA-only
 * cards (see section 14.5 of docs/compare-feature.md):
 *   - Prominent amber/orange warning banner
 *   - No "Pharmacist-reviewed" or "FDA label" badges
 *   - Suggested sources rendered with "unverified" gray badges
 *   - "Request pharmacist review" CTA is primary action
 */
function AiGeneratedResultCard({
  result,
}: {
  result: LookupResultAiGenerated;
}) {
  const { analysis } = result;
  const confidenceColor =
    analysis.confidence === "high"
      ? "text-emerald-700 dark:text-emerald-300"
      : analysis.confidence === "medium"
        ? "text-amber-700 dark:text-amber-300"
        : "text-red-700 dark:text-red-300";

  return (
    <div className="overflow-hidden rounded-md border-2 border-amber-300 bg-card dark:border-amber-800">
      {/* CRITICAL warning banner */}
      <div className="flex items-start gap-2 bg-amber-100 px-4 py-3 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-xs leading-relaxed">
          <p className="font-semibold">
            AI-generated analysis — not yet reviewed by our pharmacists
          </p>
          <p className="mt-0.5">
            This product isn&apos;t in our reviewed database or FDA label registry.
            The analysis below was generated by an AI model. Please verify with
            a pharmacist or doctor before use.
          </p>
        </div>
      </div>

      <div className="p-4">
        {/* Name + AI badge + confidence */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-tight">
              {analysis.productName}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                AI-generated
              </Badge>
              <span className={`font-medium ${confidenceColor}`}>
                Confidence: {analysis.confidence}
              </span>
              {!analysis.isLikelyOtc && (
                <span className="text-muted-foreground">
                  · May not be OTC
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
          {analysis.summary}
        </p>

        {/* Common uses */}
        {analysis.commonUses.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Common uses
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              {analysis.commonUses.slice(0, 5).map((use, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground/50">•</span>
                  <span>{use}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Active ingredients (if confident) */}
        {analysis.activeIngredients.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Active ingredients <span className="text-muted-foreground/60">(AI-identified)</span>
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {analysis.activeIngredients.slice(0, 8).map((ing) => (
                <Badge
                  key={ing}
                  variant="outline"
                  className="border-dashed text-xs font-normal text-muted-foreground"
                >
                  {ing}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {analysis.keyWarnings.length > 0 && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              ⚠️ Key warnings
            </p>
            <ul className="mt-1 space-y-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
              {analysis.keyWarnings.slice(0, 5).map((warning, i) => (
                <li key={i} className="flex gap-2">
                  <span>•</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggested (unverified) sources */}
        {analysis.suggestedSources.length > 0 && (
          <div className="mb-3 border-t pt-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Suggested sources{" "}
              <span className="font-normal text-muted-foreground/60">
                (unverified — click to check)
              </span>
            </p>
            <ul className="space-y-1.5">
              {analysis.suggestedSources.slice(0, 5).map((source, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className="shrink-0 border-dashed font-mono text-[10px] text-muted-foreground"
                  >
                    {source.type}
                  </Badge>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 text-muted-foreground hover:text-primary hover:underline"
                  >
                    <span className="truncate">{source.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Primary CTA: request pharmacist review */}
        {result.lookupId !== null && (
          <div className="border-t pt-3">
            <RequestReviewButton
              lookupId={result.lookupId}
              queryText={analysis.productName}
            />
          </div>
        )}
      </div>
    </div>
  );
}

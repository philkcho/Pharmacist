"use client";

import { useState, useTransition } from "react";
import {
  Search,
  Loader2,
  ShieldCheck,
  FileWarning,
  ExternalLink,
  MessageSquarePlus,
  CheckCircle2,
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
} from "@/lib/actions/lookup";

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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    const trimmed = query.trim();
    if (!trimmed || isPending) return;
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-primary" />
          Look up any OTC product
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Search by brand, generic name, or active ingredient. Every result is
          linked to FDA drug-label data.
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
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Look up</span>
          </Button>
        </div>

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

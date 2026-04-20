"use client";

/**
 * PersonalConsultHero — full-page consult entry.
 *
 * Used on /consult/new (and linked from mobile ConsultMobileCta on home).
 * Homepage desktop uses ConsultSidebar (compact variant) in the public layout.
 *
 * Requires authentication — the parent page handles the redirect to /login
 * when the visitor is signed out, and passes the signed-in email as a prop
 * so we can show it instead of asking for it.
 *
 * Captures the visitor's question (free text) and optional photos
 * (Rx label, product, skin).
 *
 * Mental model: chat with a pharmacist, not a search engine.
 */

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Pill,
  ArrowRight,
  Loader2,
  ShieldCheck,
  FileText,
  Camera,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitConsult } from "@/lib/actions/consults";

const PLACEHOLDER =
  "e.g. I take levothyroxine in the morning, plus iron, vitamin D, and a tretinoin cream at night. Anything I should worry about?";

interface UploadedPhoto {
  url: string;
  preview: string; // local objectURL while uploading
}

interface PersonalConsultHeroProps {
  userEmail: string;
}

export function PersonalConsultHero({ userEmail }: PersonalConsultHeroProps) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [shareByDefault, setShareByDefault] = useState(true);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const arr = Array.from(files).slice(0, 4 - photos.length); // cap 4 total
    setUploadingCount((c) => c + arr.length);

    for (const file of arr) {
      const preview = URL.createObjectURL(file);
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/consult/upload", {
          method: "POST",
          body: formData,
        });
        const json = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !json.url) {
          throw new Error(json.error ?? "Upload failed");
        }
        setPhotos((prev) => [...prev, { url: json.url!, preview }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        URL.revokeObjectURL(preview);
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => {
      const removed = prev[idx];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedText = text.trim();

    if (trimmedText.length < 5 && photos.length === 0) {
      setError("Please share a bit more — text or a photo.");
      return;
    }
    if (uploadingCount > 0) {
      setError("Please wait for photos to finish uploading.");
      return;
    }

    startTransition(async () => {
      const result = await submitConsult({
        rawInput: {
          text: trimmedText || undefined,
          photos: photos.map((p) => ({ url: p.url })),
        },
        shareByDefault,
      });
      if (!result.ok || !result.consultId) {
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(`/consult#${result.consultId}`);
    });
  }

  const canAddMore = photos.length + uploadingCount < 4;

  return (
    <section className="bg-gradient-to-b from-primary/5 to-background pb-6 pt-8">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <div className="flex items-center justify-center gap-2">
          <Pill className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Dr.pharmacist
          </h1>
        </div>

        <h2 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
          Your meds, supplements & skincare —{" "}
          <span className="text-primary">checked together.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
          Get an instant AI read in 60 seconds — plus a pharmacist&apos;s final
          review within 48 hours. Free.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-6 max-w-2xl text-left"
        >
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Pill className="h-4 w-4" />
              Dr.pharmacist
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              What are you taking, or what symptoms do you have? Snap a photo of
              the bottle/Rx label if it helps.
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={3}
              className="mt-3 resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
              disabled={isPending}
            />

            {/* Photo upload area */}
            <div className="mt-3 space-y-2">
              {(photos.length > 0 || uploadingCount > 0) && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, idx) => (
                    <div
                      key={idx}
                      className="relative h-16 w-16 overflow-hidden rounded-md border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.preview}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 hover:bg-background"
                        aria-label="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {Array.from({ length: uploadingCount }).map((_, i) => (
                    <div
                      key={`up-${i}`}
                      className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}

              {canAddMore && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                  <Camera className="h-3.5 w-3.5" />
                  {photos.length === 0
                    ? "Add photo (optional)"
                    : `Add another (${photos.length}/4)`}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                    disabled={isPending}
                  />
                </label>
              )}
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm hover:bg-muted/50">
              <input
                type="checkbox"
                checked={shareByDefault}
                onChange={(e) => setShareByDefault(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                disabled={isPending}
              />
              <span className="leading-snug">
                <span className="font-medium">Help others get this answer</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Publish the anonymized Q&amp;A after Younghun reviews it.
                  Appears in Community Q&amp;A. You can undo anytime.
                </span>
              </span>
            </label>

            {/* Email is taken from the signed-in session */}
            <p className="mt-3 text-xs text-muted-foreground">
              Reply goes to{" "}
              <span className="font-medium text-foreground">{userEmail}</span>
            </p>

            <div className="mt-3 flex items-center justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={
                  isPending ||
                  uploadingCount > 0 ||
                  (text.trim().length < 5 && photos.length === 0)
                }
                className="gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting your consult…
                  </>
                ) : (
                  <>
                    Check My Stack
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {error && (
            <p className="mt-2 text-center text-sm text-destructive">{error}</p>
          )}

          {/* Big 5 trust strip */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Reviewed by Younghun Cho, Pharmacist
            </span>
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-primary" />
              FDA + PubMed citations
            </span>
            <span>Free · Account required</span>
          </div>

          <p className="mx-auto mt-4 max-w-xl text-center text-[11px] leading-snug text-muted-foreground">
            Educational guidance, not a prescription.
          </p>
        </form>
      </div>
    </section>
  );
}

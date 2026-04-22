"use client";

/**
 * ConsultSidebar — left-rail consult entry on public layout (desktop only).
 *
 * Two states driven by userEmail prop:
 *  - Signed in: compact consult form (text + optional photos → submitConsult)
 *  - Signed out: login CTA — account required to submit a consult
 *
 * Auto-hides on /consult/* routes where the form is the primary content.
 * Mobile uses ConsultMobileCta + /consult/new instead.
 */

import { useState, useTransition, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Pill,
  ArrowRight,
  Loader2,
  ShieldCheck,
  FileText,
  Camera,
  X,
  LogIn,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitConsult } from "@/lib/actions/consults";

interface UploadedPhoto {
  url: string;
  preview: string;
}

interface ConsultSidebarProps {
  userEmail: string | null;
}

export function ConsultSidebar({ userEmail }: ConsultSidebarProps) {
  const pathname = usePathname();

  // Show only on the homepage. Sub-pages (trending / expert / analysis /
  // consult / ask / about ...) hide the rail to avoid the heavy form
  // competing with article/product content.
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  const isHome = pathWithoutLocale === "" || pathWithoutLocale === "/";
  if (!isHome) {
    return null;
  }

  return (
    <aside className="sticky top-[80px] hidden h-[calc(100vh-100px)] w-[340px] shrink-0 overflow-y-auto lg:block">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Ask your pharmacist</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Your meds, supplements &amp; skincare — reviewed together.
        </p>

        {userEmail ? (
          <AuthedForm userEmail={userEmail} />
        ) : (
          <SignInCta pathname={pathname} />
        )}

        <div className="mt-4 space-y-1.5 border-t pt-3 text-[11px] leading-snug text-muted-foreground">
          <p className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-primary" />
            Reviewed by Younghun Cho, PharmD
          </p>
          <p className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3 text-primary" />
            FDA + PubMed citations
          </p>
          <p>Free · Account required</p>
        </div>

        <p className="mt-3 text-[10px] leading-snug text-muted-foreground">
          Educational guidance, not a prescription.
        </p>
      </div>
    </aside>
  );
}

function SignInCta({ pathname }: { pathname: string }) {
  const nextParam = encodeURIComponent(pathname);
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm">
        Sign in to send your question to a licensed pharmacist and get a
        science-backed answer within 48 hours.
      </p>
      <Button
        size="lg"
        className="w-full gap-2"
        render={<Link href={`/login?next=${nextParam}`} />}
      >
        <LogIn className="h-4 w-4" />
        Sign in to ask
      </Button>
      <p className="text-[11px] text-muted-foreground">
        We use your email to notify you when the pharmacist&apos;s answer is
        ready.
      </p>
    </div>
  );
}

function AuthedForm({ userEmail }: { userEmail: string }) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [shareByDefault, setShareByDefault] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const arr = Array.from(files).slice(0, 4 - photos.length);
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
      // Stay on page — show success state instead of redirecting
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setText("");
      setPhotos([]);
      setJustSubmitted(result.consultId);
    });
  }

  function handleAskAnother() {
    setJustSubmitted(null);
    setError(null);
  }

  const canAddMore = photos.length + uploadingCount < 4;

  if (justSubmitted) {
    return (
      <div className="mt-3 space-y-3">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-2 text-sm font-semibold">Sent to the pharmacist</p>
          <p className="mt-1 text-xs text-muted-foreground">
            We&apos;ll email you at{" "}
            <span className="font-medium">{userEmail}</span> when the
            pharmacist&apos;s answer is ready (within 48 hours).
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2"
          render={<Link href="/consult" />}
        >
          View my questions
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <button
          type="button"
          onClick={handleAskAnother}
          className="w-full text-xs text-muted-foreground hover:text-foreground"
        >
          Ask another question
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Pill className="h-3.5 w-3.5" />
        Dr.pharmacist
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. I take levothyroxine in the morning, plus iron, vitamin D, and tretinoin at night. Anything I should worry about?"
        rows={4}
        className="mt-2 resize-none text-sm"
        disabled={isPending}
      />

      <div className="mt-3 space-y-2">
        {(photos.length > 0 || uploadingCount > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {photos.map((p, idx) => (
              <div
                key={idx}
                className="relative h-12 w-12 overflow-hidden rounded-md border"
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
                  className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 hover:bg-background"
                  aria-label="Remove photo"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            {Array.from({ length: uploadingCount }).map((_, i) => (
              <div
                key={`up-${i}`}
                className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            ))}
          </div>
        )}

        {canAddMore && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">
            <Camera className="h-3 w-3" />
            {photos.length === 0
              ? "Add photo (Rx, product)"
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

      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border bg-muted/30 p-2.5 text-xs hover:bg-muted/50">
        <input
          type="checkbox"
          checked={shareByDefault}
          onChange={(e) => setShareByDefault(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary"
          disabled={isPending}
        />
        <span className="leading-snug">
          <span className="font-medium">Help others get this answer</span>
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            Publish the anonymized Q&amp;A after Younghun reviews it. You can
            undo anytime.
          </span>
        </span>
      </label>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Reply goes to <span className="font-medium">{userEmail}</span>
      </p>

      <Button
        type="submit"
        size="lg"
        className="mt-2 w-full gap-2"
        disabled={
          isPending ||
          uploadingCount > 0 ||
          (text.trim().length < 5 && photos.length === 0)
        }
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting your consult…
          </>
        ) : (
          <>
            Ask
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </form>
  );
}

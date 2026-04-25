"use client";

import { useRef, useState } from "react";
import { Download, Copy, Check, X, Share2, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { SocialCard, type SocialCardData, type SocialCardSize } from "./social-card";

const SIZES: { id: SocialCardSize; label: string; subLabel: string }[] = [
  { id: "story", label: "Story", subLabel: "9:16" },
  { id: "square", label: "Post", subLabel: "1:1" },
  { id: "wide", label: "Wide", subLabel: "2:1" },
];

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  data: SocialCardData;
}

export function ShareSheet({ open, onClose, data }: ShareSheetProps) {
  const [size, setSize] = useState<SocialCardSize>("story");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const message = buildShareMessage(data);

  async function handleDownload() {
    if (!cardRef.current) return;
    try {
      setBusy(true);
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        skipFonts: false,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${slugify(data.productName)}-${size}.png`;
      link.click();
    } catch (err) {
      console.error("Failed to export card:", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleNativeShare() {
    if (!navigator.share) {
      handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: data.productName,
        text: message,
        url: data.url,
      });
    } catch {
      // user cancelled — silent
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${message}\n${data.url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-background shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-muted" />
        </div>

        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">Share this</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Size picker */}
          <div className="flex gap-2">
            {SIZES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSize(s.id)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  size === s.id
                    ? "border-primary bg-primary/5 font-semibold text-primary"
                    : "hover:bg-muted"
                }`}
              >
                <div>{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.subLabel}</div>
              </button>
            ))}
          </div>

          {/* Card preview — capped height so 9:16 doesn't overflow */}
          <div className="mx-auto max-h-[60vh] overflow-hidden rounded-xl">
            <div
              className={
                size === "story"
                  ? "mx-auto w-[200px]"
                  : size === "square"
                    ? "mx-auto w-[320px]"
                    : "w-full"
              }
            >
              <SocialCard ref={cardRef} size={size} data={data} />
            </div>
          </div>

          {/* Pre-written message */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-mono text-xs leading-relaxed text-muted-foreground">
              {message}
              <br />
              {data.url}
            </p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={busy}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="ml-1.5 hidden sm:inline">Save</span>
            </Button>
            <Button variant="outline" onClick={handleCopy} className="w-full">
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="ml-1.5 hidden sm:inline">
                {copied ? "Copied" : "Copy"}
              </span>
            </Button>
            <Button onClick={handleNativeShare} className="w-full">
              <Share2 className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">Share</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildShareMessage(data: SocialCardData): string {
  const reviewer = data.reviewerName.split(",")[0];
  if (data.score !== null && data.score !== undefined) {
    const type = data.productType ?? "product";
    return `Found a ${data.score}/100 ${type} verified by a real pharmacist 🧠 — review by ${reviewer}.`;
  }
  return `${data.productName} — pharmacist insight from ${reviewer} 🧠`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

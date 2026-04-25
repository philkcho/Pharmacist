"use client";

import { useState } from "react";
import { Share2, Bell, ShoppingCart, ExternalLink } from "lucide-react";
import { ShareSheet } from "./share-sheet";
import { SubscribeSheet } from "@/components/subscribe/subscribe-sheet";
import type { SocialCardData } from "./social-card";

export interface CtaPurchaseOption {
  linkId: number;
  retailerName: string;
}

export interface GlobalCtaBarProps {
  /** Data passed to the share sheet's social card and native share. */
  shareData: SocialCardData;
  /** Pre-selected category slug for the subscribe sheet. */
  defaultCategorySlug?: string | null;
  /** Optional Buy buttons folded into the same sticky bar (analysis page). */
  purchaseOptions?: CtaPurchaseOption[];
}

/**
 * Single mobile-first sticky bottom bar combining Buy / Share / Subscribe so
 * actions never hide each other. Replaces the legacy StickyBuyBar.
 *
 * Share opens the OS native share sheet (Web Share API) immediately for
 * one-tap delivery to KakaoTalk / Instagram / Twitter / SMS. Falls back to
 * the card-download modal if the API is unavailable or the user cancels.
 */
export function GlobalCtaBar({
  shareData,
  defaultCategorySlug,
  purchaseOptions,
}: GlobalCtaBarProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  const buyOption = purchaseOptions?.[0];
  const message = buildShareMessage(shareData);

  async function handleShareClick() {
    // Try native share first — this is what the user actually wants:
    // KakaoTalk / Instagram / Twitter / SMS in one tap.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: shareData.productName,
          text: message,
          url: shareData.url,
        });
        return;
      } catch (err) {
        // User cancelled — silent. Other errors (no permission, AbortError):
        // fall through to the card modal so they still have a way to share.
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    setShareOpen(true);
  }

  return (
    <>
      {/* Single sticky bottom bar — mobile + desktop */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          {buyOption && (
            <a
              href={`/api/click/${buyOption.linkId}?ref=analysis_page`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:flex-none sm:px-5"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Buy on </span>
              {buyOption.retailerName}
              <ExternalLink className="h-3 w-3 opacity-80" />
            </a>
          )}
          <button
            onClick={handleShareClick}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 sm:flex-none sm:px-5"
            aria-label="Share to messenger or social"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            onClick={() => setSubscribeOpen(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 sm:flex-none sm:px-5"
            aria-label="Subscribe to daily picks"
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Subscribe</span>
            <span className="sm:hidden">Daily picks</span>
          </button>
        </div>
      </div>

      {/* Spacer so page content isn't hidden behind sticky bar */}
      <div className="h-16 sm:h-20" aria-hidden />

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        data={shareData}
      />
      <SubscribeSheet
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        defaultCategorySlug={defaultCategorySlug}
      />
    </>
  );
}

function buildShareMessage(data: SocialCardData): string {
  const type = data.productType ?? "product";
  const reviewer = data.reviewerName.split(",")[0]; // strip ", PharmD"
  if (data.score !== null && data.score !== undefined) {
    return `Found a ${data.score}/100 ${type} verified by a real pharmacist 🧠 — review by ${reviewer}.`;
  }
  return `Pharmacist-verified ${type} review by ${reviewer}.`;
}

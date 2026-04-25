"use client";

import { useState, useEffect, useRef } from "react";
import { Share2, Bell, ShoppingCart, ExternalLink } from "lucide-react";
import { ShareSheet } from "./share-sheet";
import { SubscribeSheet } from "@/components/subscribe/subscribe-sheet";
import type { SocialCardData } from "./social-card";

/**
 * Anchors the bar to the visible bottom even when iOS Safari's URL/tab bar
 * slides back in (which otherwise hides position:fixed bottom:0 elements
 * behind it on scroll-up). Uses VisualViewport API; no-op on browsers
 * that already pin fixed bars correctly (Android Chrome, desktop).
 */
function useVisualViewportPin() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!el || !vv) return;

    const update = () => {
      // How far the visible bottom sits above the layout viewport bottom.
      // Positive when iOS toolbars cover part of the layout viewport.
      const offset = Math.max(
        0,
        window.innerHeight - (vv.height + vv.offsetTop)
      );
      el.style.transform = offset > 0 ? `translateY(-${offset}px)` : "";
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return ref;
}

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
  /** Hide the Subscribe button (e.g. on trend articles where Share is the only CTA). */
  showSubscribe?: boolean;
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
  showSubscribe = true,
}: GlobalCtaBarProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const barRef = useVisualViewportPin();

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
      {/* Single sticky bottom bar — mobile + desktop.
          The chat-sidebar floating button now sits ABOVE this bar (bottom-24)
          so the bar can take the full width.
          paddingBottom respects iOS home-indicator safe area on iPhone X+.
          The visualViewport pin keeps the bar glued to the visible bottom
          when the URL/tab bar slides in or out (Android Chrome + iOS Safari). */}
      <div
        ref={barRef}
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 will-change-transform"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          {buyOption && (
            <a
              href={`/api/click/${buyOption.linkId}?ref=analysis_page`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate rounded-lg bg-primary px-2 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:flex-none sm:px-5"
            >
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span className="truncate">
                <span className="hidden sm:inline">Buy on </span>
                {buyOption.retailerName}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-80" />
            </a>
          )}
          <button
            onClick={handleShareClick}
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary px-2 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 sm:flex-none sm:px-5"
            aria-label="Share to messenger or social"
          >
            <Share2 className="h-4 w-4 shrink-0" />
            <span>Share</span>
          </button>
          {showSubscribe && (
            <button
              onClick={() => setSubscribeOpen(true)}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-2 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 sm:flex-none sm:px-5"
              aria-label="Subscribe to daily picks"
            >
              <Bell className="h-4 w-4 shrink-0" />
              <span className="truncate">
                <span className="hidden sm:inline">Subscribe</span>
                <span className="sm:hidden">Daily</span>
              </span>
            </button>
          )}
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
  const reviewer = data.reviewerName.split(",")[0]; // strip ", PharmD"
  // Scored product (analysis page)
  if (data.score !== null && data.score !== undefined) {
    const type = data.productType ?? "product";
    return `Found a ${data.score}/100 ${type} verified by a real pharmacist 🧠 — review by ${reviewer}.`;
  }
  // Trend article / unscored content — lead with the title itself
  return `${data.productName} — pharmacist insight from ${reviewer} 🧠`;
}

"use client";

import { useState } from "react";
import { Share2, Bell } from "lucide-react";
import { ShareSheet } from "./share-sheet";
import { SubscribeSheet } from "@/components/subscribe/subscribe-sheet";
import type { SocialCardData } from "./social-card";

export interface GlobalCtaBarProps {
  /** Data passed to the share sheet's social card. */
  shareData: SocialCardData;
  /** Pre-selected category slug for the subscribe sheet. */
  defaultCategorySlug?: string | null;
}

/**
 * Mobile-first sticky bottom bar + desktop floating action buttons.
 * Renders on every content page so guests can share or subscribe in one tap.
 *
 * Hidden on home, admin, auth, and settings pages (mounted per-page only).
 */
export function GlobalCtaBar({
  shareData,
  defaultCategorySlug,
}: GlobalCtaBarProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  return (
    <>
      {/* Mobile: sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden">
        <div className="flex gap-2 p-3">
          <button
            onClick={() => setShareOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary py-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            onClick={() => setSubscribeOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Bell className="h-4 w-4" />
            Subscribe
          </button>
        </div>
      </div>

      {/* Desktop: floating action buttons (bottom-right) */}
      <div className="fixed bottom-6 right-6 z-30 hidden flex-col gap-2 sm:flex">
        <button
          onClick={() => setSubscribeOpen(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl"
        >
          <Bell className="h-4 w-4" />
          Subscribe
        </button>
        <button
          onClick={() => setShareOpen(true)}
          className="flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-secondary-foreground shadow-lg transition-all hover:bg-secondary/80 hover:shadow-xl"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>

      {/* Spacer for mobile so content isn't hidden behind sticky bar */}
      <div className="h-20 sm:hidden" aria-hidden />

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

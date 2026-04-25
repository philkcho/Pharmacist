"use client";

import { forwardRef } from "react";
import { ShieldCheck } from "lucide-react";
import { scoreTier } from "./score-badge";
import { BRAND } from "@/lib/brand";

const TIER_BG = {
  excellent: "from-emerald-500 to-emerald-600",
  good: "from-lime-500 to-lime-600",
  average: "from-amber-500 to-amber-600",
  poor: "from-rose-500 to-rose-600",
} as const;

const TIER_LABEL = {
  excellent: "Excellent",
  good: "Good",
  average: "Average",
  poor: "Below Average",
} as const;

export type SocialCardSize = "story" | "square" | "wide";

const SIZE_PX: Record<SocialCardSize, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: "9:16 Story" },
  square: { w: 1080, h: 1080, label: "1:1 Square" },
  wide: { w: 1200, h: 600, label: "2:1 Wide" },
};

export interface SocialCardData {
  productName: string;
  verdict?: string | null;
  score?: number | null;
  productImageUrl?: string | null;
  productType?: string | null;
  url: string;
  reviewerName: string;
}

interface SocialCardProps {
  size: SocialCardSize;
  data: SocialCardData;
  /** Use a fixed pixel canvas (for export). When false, scales to container width. */
  exportMode?: boolean;
}

export const SocialCard = forwardRef<HTMLDivElement, SocialCardProps>(
  function SocialCard({ size, data, exportMode = false }, ref) {
    const dims = SIZE_PX[size];
    const tier = data.score !== null && data.score !== undefined
      ? scoreTier(data.score)
      : "good";
    const gradient = TIER_BG[tier];
    const tierLabel = TIER_LABEL[tier];

    // For export: use exact pixel sizes. For preview: aspect ratio + scale to container.
    const style = exportMode
      ? { width: `${dims.w}px`, height: `${dims.h}px` }
      : {
          width: "100%",
          aspectRatio: `${dims.w} / ${dims.h}`,
        };

    const isStory = size === "story";
    const isWide = size === "wide";

    return (
      <div
        ref={ref}
        style={style}
        className={`relative overflow-hidden bg-slate-900 ${
          exportMode ? "" : "rounded-xl border"
        }`}
      >
        {/* Background — product image with overlay */}
        {data.productImageUrl ? (
          <>
            <img
              src={data.productImageUrl}
              alt=""
              crossOrigin="anonymous"
              className="absolute inset-0 h-full w-full object-cover opacity-30 blur-xl"
            />
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-70`} />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
        )}

        {/* Foreground content */}
        <div
          className={`relative flex h-full w-full flex-col justify-between text-white ${
            isWide ? "p-12" : isStory ? "p-16" : "p-12"
          }`}
        >
          {/* Top: brand + reviewer */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 ${isStory ? "text-2xl" : "text-lg"} font-bold tracking-tight`}>
              <span>💊</span>
              <span>{BRAND.name}</span>
            </div>
          </div>

          {/* Middle: score + product */}
          <div className={`flex flex-col items-start ${isStory ? "gap-8" : isWide ? "gap-4" : "gap-6"}`}>
            {data.score !== null && data.score !== undefined && (
              <div className="flex items-end gap-3">
                <div
                  className={`font-black leading-none ${
                    isStory ? "text-[12rem]" : isWide ? "text-7xl" : "text-9xl"
                  }`}
                >
                  {data.score}
                </div>
                <div className={`pb-3 leading-tight ${isStory ? "text-3xl" : "text-xl"} font-bold opacity-90`}>
                  / 100
                </div>
              </div>
            )}

            {data.score !== null && data.score !== undefined && (
              <div
                className={`inline-block rounded-full bg-white/20 px-4 py-2 font-semibold backdrop-blur ${
                  isStory ? "text-2xl" : "text-base"
                }`}
              >
                {tierLabel}
              </div>
            )}

            <div>
              <h2
                className={`font-bold leading-tight ${
                  isStory ? "text-5xl" : isWide ? "text-3xl" : "text-4xl"
                }`}
              >
                {data.productName}
              </h2>
              {data.verdict && (
                <p
                  className={`mt-4 leading-snug opacity-95 ${
                    isStory ? "text-2xl" : "text-base"
                  }`}
                >
                  &ldquo;{truncate(data.verdict, isStory ? 180 : isWide ? 90 : 120)}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Bottom: reviewer + url */}
          <div className="flex flex-col gap-2">
            <div
              className={`flex items-center gap-2 font-medium opacity-95 ${
                isStory ? "text-xl" : "text-sm"
              }`}
            >
              <ShieldCheck className={isStory ? "h-6 w-6" : "h-4 w-4"} />
              <span>Reviewed by {data.reviewerName}</span>
            </div>
            <div className={`opacity-80 ${isStory ? "text-lg" : "text-xs"}`}>
              {BRAND.domain} · Get weekly picks
            </div>
          </div>
        </div>
      </div>
    );
  }
);

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

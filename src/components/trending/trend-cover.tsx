/**
 * AI PharmCare branded cover — fallback thumbnail for trending articles
 * that have no imageUrl. Mirrors DrCover styling so "Worth the Hype?"
 * cards look consistent with Dr.'s Analysis cards.
 */

import { Sparkles, TrendingUp } from "lucide-react";

interface TrendCoverProps {
  category: string;
  className?: string;
}

const CATEGORY_GRADIENT: Record<string, string> = {
  health:
    "from-sky-100 via-blue-50 to-indigo-100 dark:from-sky-950/40 dark:via-blue-950/30 dark:to-indigo-950/40",
  beauty_fitness:
    "from-rose-100 via-pink-50 to-amber-100 dark:from-rose-950/40 dark:via-pink-950/30 dark:to-amber-950/40",
  beauty:
    "from-rose-100 via-pink-50 to-amber-100 dark:from-rose-950/40 dark:via-pink-950/30 dark:to-amber-950/40",
};

export function TrendCover({ category, className = "" }: TrendCoverProps) {
  const gradient = CATEGORY_GRADIENT[category] ?? CATEGORY_GRADIENT.health;

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${gradient} p-6 ${className}`}
    >
      {/* Decorative background marks */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Sparkles className="absolute -left-4 -top-4 h-24 w-24 rotate-12 text-primary/5" />
        <TrendingUp className="absolute -bottom-6 -right-6 h-28 w-28 -rotate-12 text-primary/5" />
        <Sparkles className="absolute right-10 top-6 h-10 w-10 rotate-[135deg] text-primary/10" />
      </div>

      {/* Brand */}
      <div className="relative flex flex-col items-center text-center">
        <div className="flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold tracking-tight text-primary">
            AI PharmCare
          </span>
        </div>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Worth the Hype?
        </p>
      </div>

      {/* Bottom label */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
        Trending Analysis
      </div>
    </div>
  );
}

import { ShieldCheck } from "lucide-react";
import { SITE_AUTHOR } from "@/lib/author";

const TIER = {
  excellent: {
    bg: "bg-emerald-500",
    ring: "ring-emerald-500/30",
    text: "text-white",
    label: "Excellent",
  },
  good: {
    bg: "bg-lime-500",
    ring: "ring-lime-500/30",
    text: "text-white",
    label: "Good",
  },
  average: {
    bg: "bg-amber-500",
    ring: "ring-amber-500/30",
    text: "text-white",
    label: "Average",
  },
  poor: {
    bg: "bg-rose-500",
    ring: "ring-rose-500/30",
    text: "text-white",
    label: "Below Average",
  },
} as const;

export function scoreTier(score: number): keyof typeof TIER {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "average";
  return "poor";
}

interface ScoreBadgeProps {
  score: number;
  rationale?: string | null;
  size?: "sm" | "md" | "lg";
  showReviewer?: boolean;
}

export function ScoreBadge({
  score,
  rationale,
  size = "md",
  showReviewer = true,
}: ScoreBadgeProps) {
  const tier = scoreTier(score);
  const t = TIER[tier];

  const sizeClasses = {
    sm: { circle: "h-14 w-14 text-lg", label: "text-[10px]" },
    md: { circle: "h-20 w-20 text-2xl", label: "text-xs" },
    lg: { circle: "h-28 w-28 text-4xl", label: "text-sm" },
  }[size];

  return (
    <div className="flex items-center gap-4">
      <div
        className={`flex shrink-0 flex-col items-center justify-center rounded-full ring-4 ${t.bg} ${t.ring} ${t.text} ${sizeClasses.circle} font-bold leading-none`}
        aria-label={`${t.label} score ${score} out of 100`}
      >
        <span>{score}</span>
        <span className={`mt-0.5 font-medium opacity-80 ${sizeClasses.label}`}>
          /100
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${t.bg} ${t.text}`}>
            {t.label}
          </span>
        </div>
        {showReviewer && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            Reviewed by {SITE_AUTHOR.displayName}
          </p>
        )}
        {rationale && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {rationale}
          </p>
        )}
      </div>
    </div>
  );
}

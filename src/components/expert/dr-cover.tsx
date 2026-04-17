/**
 * Dr.pharmacist branded cover — used as thumbnail for all Dr.'s Analysis content.
 * Makes every analysis look like it came from the Dr.pharmacist brand.
 * Shows ONLY the brand (title is shown separately in the card below).
 */

import { Pill } from "lucide-react";

interface DrCoverProps {
  category: string;
  className?: string;
}

const CATEGORY_GRADIENT: Record<string, string> = {
  health:
    "from-sky-100 via-blue-50 to-indigo-100 dark:from-sky-950/40 dark:via-blue-950/30 dark:to-indigo-950/40",
  "skin-care":
    "from-rose-100 via-pink-50 to-amber-100 dark:from-rose-950/40 dark:via-pink-950/30 dark:to-amber-950/40",
  wellness:
    "from-emerald-100 via-teal-50 to-cyan-100 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/40",
};

export function DrCover({ category, className = "" }: DrCoverProps) {
  const gradient = CATEGORY_GRADIENT[category] ?? CATEGORY_GRADIENT.health;

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${gradient} p-6 ${className}`}
    >
      {/* Decorative background pills */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Pill className="absolute -left-4 -top-4 h-24 w-24 rotate-12 text-primary/5" />
        <Pill className="absolute -bottom-6 -right-6 h-32 w-32 -rotate-45 text-primary/5" />
        <Pill className="absolute right-10 top-6 h-12 w-12 rotate-[135deg] text-primary/10" />
      </div>

      {/* Brand */}
      <div className="relative flex flex-col items-center text-center">
        <div className="flex items-center gap-2">
          <Pill className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold tracking-tight text-primary">
            Dr.pharmacist
          </span>
        </div>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Dr.&apos;s Analysis
        </p>
      </div>

      {/* Bottom label */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
        Pharmacist-Reviewed
      </div>
    </div>
  );
}

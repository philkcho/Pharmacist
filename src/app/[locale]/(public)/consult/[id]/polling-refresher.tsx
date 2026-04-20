"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polls the page until the AI draft is ready. Called only when
// ai_completed_at is null on first render. Uses router.refresh()
// (RSC-safe) and stops when the draft arrives.
export function ConsultPollingRefresher({ consultId }: { consultId: string }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 60; // ~60s of polling at 1s interval

    const tick = () => {
      if (cancelled) return;
      attempts += 1;
      router.refresh();
      if (attempts < maxAttempts) {
        setTimeout(tick, 2000);
      }
    };

    const initial = setTimeout(tick, 2000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
    };
  }, [consultId, router]);
  return null;
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Lightweight page-view tracker.
 *
 * - Sends a "view" event on each navigation (pathname change)
 * - Sends a "duration" event via sendBeacon on page hide / unload
 * - Zero visual output, zero external dependencies
 */
export function PageTracker() {
  const pathname = usePathname();
  const viewRef = useRef<{ id: number | null; start: number }>({
    id: null,
    start: 0,
  });

  useEffect(() => {
    // ── Start new page view ──
    const start = performance.now();
    viewRef.current = { id: null, start };

    const controller = new AbortController();

    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "view",
        path: pathname,
        referrer: document.referrer || undefined,
      }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) viewRef.current.id = data.id;
      })
      .catch(() => {});

    // ── Send duration on page hide ──
    function sendDuration() {
      const { id, start: s } = viewRef.current;
      if (!id) return;
      const durationSeconds = Math.round((performance.now() - s) / 1000);
      if (durationSeconds < 1) return;

      const payload = JSON.stringify({
        action: "duration",
        id,
        durationSeconds,
      });

      // sendBeacon is reliable during page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/analytics/pageview",
          new Blob([payload], { type: "application/json" })
        );
      }
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") sendDuration();
    });

    // Cleanup: send duration for current page when navigating away
    return () => {
      controller.abort();
      sendDuration();
      document.removeEventListener("visibilitychange", sendDuration);
    };
  }, [pathname]);

  return null;
}

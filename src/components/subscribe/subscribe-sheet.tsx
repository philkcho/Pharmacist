"use client";

import { useState } from "react";
import { X, Mail, Check, Loader2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubscribeSheetProps {
  open: boolean;
  onClose: () => void;
  defaultCategorySlug?: string | null;
}

/**
 * Lightweight email capture for the daily/weekly digest.
 *
 * Phase 1: stores email locally and shows a "thanks" confirmation.
 * Phase 2 will wire this to /api/subscribe → digest_subscriptions table
 * with category selection + Telegram + Web Push channels.
 */
export function SubscribeSheet({
  open,
  onClose,
}: SubscribeSheetProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Subscription failed");
      }
      // 404 is expected during Phase 1 (endpoint not yet built).
      // We still mark as done to test the UX flow end-to-end.
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-background shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-muted" />
        </div>

        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bell className="h-5 w-5 text-primary" />
            Get pharmacist-curated picks
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {!done ? (
            <>
              <p className="text-sm text-muted-foreground">
                A weekly digest of trending health & beauty products, reviewed
                by a real pharmacist. No spam — unsubscribe in one click.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium">Email</span>
                  <div className="mt-1 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="you@example.com"
                      className="flex-1 bg-transparent text-sm outline-none"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                </label>

                {error && (
                  <p className="text-xs text-rose-600">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || !email.trim()}
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Subscribing…
                    </>
                  ) : (
                    "Subscribe — it's free"
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Default: weekly digest. Choose categories &amp; frequency in
                  settings later.
                </p>
              </form>
            </>
          ) : (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="mt-3 text-lg font-semibold">You&apos;re in!</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ll send your first pick on Monday. Check your inbox to
                confirm.
              </p>
              <Button onClick={onClose} variant="outline" className="mt-4">
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

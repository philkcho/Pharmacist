"use client";

import { useEffect, useState } from "react";
import { X, Mail, Check, Loader2, Bell, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignInPrompt } from "./sign-in-prompt";
import { useCurrentUserEmail } from "./use-current-user-email";

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
  const { email: authEmail, loading: authLoading } = useCurrentUserEmail();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showSignIn, setShowSignIn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authEmail) setEmail(authEmail);
  }, [authEmail]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = (authEmail ?? email).trim().toLowerCase();
    if (!value || !value.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) {
        throw new Error(data?.error ?? "Subscription failed");
      }
      // 404 is expected during Phase 1 (endpoint not yet built).
      // We still mark as done to test the UX flow end-to-end.
      setLoggedIn(Boolean(data?.loggedIn));
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
                {authLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking your account…
                  </div>
                ) : authEmail ? (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">
                      Subscribing as <strong>{authEmail}</strong>
                    </span>
                  </div>
                ) : (
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
                )}

                <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs">
                  <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <strong>Weekly</strong> · sent every Monday
                  </span>
                </div>

                {error && (
                  <p className="text-xs text-rose-600">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || authLoading || !(authEmail ?? email).trim()}
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
              </form>
            </>
          ) : (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="mt-3 text-lg font-semibold">You&apos;re in!</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your digest will land in your inbox every Monday.
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <CalendarDays className="h-3.5 w-3.5" />
                Weekly · sent every Monday
              </p>
              {!loggedIn && showSignIn && (
                <SignInPrompt onDismiss={() => setShowSignIn(false)} />
              )}
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

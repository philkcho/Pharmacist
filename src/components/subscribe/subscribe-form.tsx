"use client";

import { useEffect, useState } from "react";
import { Mail, Loader2, Check, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignInPrompt } from "./sign-in-prompt";
import { useCurrentUserEmail } from "./use-current-user-email";

interface SubscribeFormProps {
  source?: string;
}

/**
 * Inline subscribe form used on the /subscribe page.
 * Phase 1: every signup is a Monday weekly digest. Frequency selection
 * will return when we expand the digest tooling.
 */
export function SubscribeForm({
  source = "subscribe_page",
}: SubscribeFormProps) {
  const { email: authEmail, loading: authLoading } = useCurrentUserEmail();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showSignIn, setShowSignIn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill when we discover the user is signed in.
  useEffect(() => {
    if (authEmail) setEmail(authEmail);
  }, [authEmail]);

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
        body: JSON.stringify({
          email: value,
          source,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Subscription failed");
      }
      setLoggedIn(Boolean(data.loggedIn));
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const effectiveEmail = authEmail ?? email;

  if (done) {
    return (
      <div className="py-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="mt-3 text-xl font-semibold">You&apos;re in!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll deliver your digest every Monday to{" "}
          <strong>{effectiveEmail}</strong>.
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <CalendarDays className="h-3.5 w-3.5" />
          Weekly · sent every Monday
        </p>
        {!loggedIn && showSignIn && (
          <SignInPrompt onDismiss={() => setShowSignIn(false)} />
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {authLoading ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your account…
        </div>
      ) : authEmail ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 truncate">
            Subscribing as <strong>{authEmail}</strong>
          </span>
        </div>
      ) : (
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <div className="mt-1.5 flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/30">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              required
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
          <strong>Weekly</strong> · sent every Monday. Unsubscribe in one
          click.
        </span>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={busy || authLoading || !effectiveEmail.trim()}
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
  );
}

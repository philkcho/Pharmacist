"use client";

import { useEffect, useState } from "react";
import { Mail, Loader2, Check, BellRing, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignInPrompt } from "./sign-in-prompt";
import { useCurrentUserEmail } from "./use-current-user-email";

/**
 * One-line email capture in the global footer. Same backend as SubscribeSheet
 * (POST /api/subscribe). Default frequency = weekly.
 */
export function FooterSubscribe() {
  const { email: authEmail, loading: authLoading } = useCurrentUserEmail();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    if (authEmail) setEmail(authEmail);
  }, [authEmail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = (authEmail ?? email).trim().toLowerCase();
    if (!value || !value.includes("@")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));
      setLoggedIn(Boolean(data?.loggedIn));
      setDone(true);
    } catch {
      // soft-fail — Phase 1 stub
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-1.5 text-sm">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          Thanks — you&apos;ll get your digest every Monday.
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          Weekly · sent every Monday
        </span>
        {!loggedIn && <SignInPrompt variant="inline" />}
      </div>
    );
  }

  // One-click variant for signed-in visitors — no email input needed.
  if (!authLoading && authEmail) {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md items-center gap-2"
      >
        <div className="flex flex-1 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 truncate" title={authEmail}>
            {authEmail}
          </span>
        </div>
        <Button type="submit" size="sm" disabled={busy} className="gap-1">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <BellRing className="h-3.5 w-3.5" />
              Subscribe
            </>
          )}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md items-center gap-2"
    >
      <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <input
          type="email"
          required
          placeholder="you@example.com"
          className="flex-1 bg-transparent text-sm outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy || authLoading}
          aria-label="Email for weekly picks"
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={busy || authLoading || !email.trim()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get picks"}
      </Button>
    </form>
  );
}

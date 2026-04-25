"use client";

import { useState } from "react";
import { Mail, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * One-line email capture in the global footer. Same backend as SubscribeSheet
 * (POST /api/subscribe). Default frequency = weekly.
 */
export function FooterSubscribe() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;
    setBusy(true);
    try {
      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
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
      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Thanks — check your inbox to confirm.
      </div>
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
          disabled={busy}
          aria-label="Email for daily picks"
        />
      </div>
      <Button type="submit" size="sm" disabled={busy || !email.trim()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get picks"}
      </Button>
    </form>
  );
}

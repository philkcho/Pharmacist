"use client";

import { useState } from "react";
import { Mail, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly", sub: "Mondays · default · safest" },
  { value: "3x_week", label: "3× / week", sub: "Mon · Wed · Fri" },
  { value: "daily", label: "Daily", sub: "One pick per day" },
  {
    value: "critical_only",
    label: "Critical only",
    sub: "Recalls + drug interaction alerts",
  },
] as const;

type Frequency = (typeof FREQUENCY_OPTIONS)[number]["value"];

interface SubscribeFormProps {
  source?: string;
  defaultFrequency?: Frequency;
}

/**
 * Inline subscribe form used on the /subscribe page.
 * Mirrors SubscribeSheet's submission logic so the API surface stays
 * single (POST /api/subscribe → email_subscribers upsert).
 */
export function SubscribeForm({
  source = "subscribe_page",
  defaultFrequency = "weekly",
}: SubscribeFormProps) {
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<Frequency>(defaultFrequency);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          source,
          frequency,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Subscription failed");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="py-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="mt-3 text-xl font-semibold">You&apos;re in!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll send your first {frequency === "weekly" ? "Monday" : ""}{" "}
          pick to <strong>{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <fieldset>
        <legend className="text-sm font-medium">How often?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {FREQUENCY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer rounded-lg border p-3 text-sm transition-colors ${
                frequency === opt.value
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="frequency"
                value={opt.value}
                checked={frequency === opt.value}
                onChange={() => setFrequency(opt.value)}
                disabled={busy}
                className="sr-only"
              />
              <div className="font-semibold">{opt.label}</div>
              <div className="text-xs text-muted-foreground">{opt.sub}</div>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <Button
        type="submit"
        className="w-full"
        size="lg"
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
    </form>
  );
}

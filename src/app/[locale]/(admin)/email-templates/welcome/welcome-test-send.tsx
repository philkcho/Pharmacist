"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Check, AlertTriangle } from "lucide-react";

interface Props {
  mode?: "signup" | "subscribed";
}

export function WelcomeTestSend({ mode = "signup" }: Props) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok"; id?: string }
    | { kind: "err"; message: string }
  >({ kind: "idle" });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setStatus({ kind: "err", message: "Enter a valid email." });
      return;
    }

    startTransition(async () => {
      setStatus({ kind: "idle" });
      try {
        const res = await fetch("/api/admin/email-templates/welcome/test-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed, mode }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        setStatus({ kind: "ok", id: data.id });
      } catch (err) {
        setStatus({
          kind: "err",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="min-w-[260px] flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        disabled={pending}
        required
      />
      <Button type="submit" disabled={pending || !email.trim()}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send test
          </>
        )}
      </Button>

      {status.kind === "ok" && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
          <Check className="h-3.5 w-3.5" />
          Sent{status.id ? ` · id ${status.id}` : ""}
        </span>
      )}
      {status.kind === "err" && (
        <span className="inline-flex items-center gap-1 text-xs text-rose-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {status.message}
        </span>
      )}
    </form>
  );
}

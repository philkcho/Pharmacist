"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface SignInPromptProps {
  /**
   * Where to return after the OAuth callback. Defaults to the current path so
   * the user lands back on the page they subscribed from.
   */
  next?: string;
  variant?: "card" | "inline";
  onDismiss?: () => void;
}

/**
 * Soft sign-in nudge shown after a successful subscribe. The email row is
 * already saved either way — this just offers to attach an account so the
 * user can manage frequency/categories and unsubscribe in one click later.
 *
 * Auth callback (`/auth/callback`) auto-links the subscriber row by email.
 */
export function SignInPrompt({
  next,
  variant = "card",
  onDismiss,
}: SignInPromptProps) {
  const [busy, setBusy] = useState(false);

  async function handleGoogleSignIn() {
    setBusy(true);
    try {
      const supabase = createClient();
      const target =
        next ?? (typeof window !== "undefined" ? window.location.pathname : "/");
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback,
          queryParams: {
            access_type: "online",
            prompt: "select_account",
          },
        },
      });
    } finally {
      // Browser navigates away on success; this only resets if OAuth init failed.
      setBusy(false);
    }
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={busy}
        className="text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60"
      >
        {busy ? "Opening Google…" : "Sign in to save preferences →"}
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-3 text-left">
      <p className="text-sm font-medium">Save your preferences?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Create a free account to manage frequency, change categories, or
        unsubscribe in one click.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="sm"
          onClick={handleGoogleSignIn}
          disabled={busy}
          className="gap-2"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening Google…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </>
          )}
        </Button>
        {onDismiss && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            disabled={busy}
          >
            Maybe later
          </Button>
        )}
      </div>
    </div>
  );
}

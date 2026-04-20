"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Globe, Lock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { setConsultVisibility } from "@/lib/actions/consults";

interface PublishToggleProps {
  consultId: string;
  visibility: "public" | "private";
  slug: string | null;
}

export function PublishToggle({
  consultId,
  visibility,
  slug,
}: PublishToggleProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(slug);
  const [currentVisibility, setCurrentVisibility] = useState(visibility);
  const router = useRouter();

  function handleToggle(next: "public" | "private") {
    setError(null);
    startTransition(async () => {
      const result = await setConsultVisibility(consultId, next);
      if (!result.ok) {
        setError(result.error ?? "Failed to update visibility");
        return;
      }
      setCurrentVisibility(next);
      if (result.slug) setCurrentSlug(result.slug);
      router.refresh();
    });
  }

  if (currentVisibility === "public") {
    return (
      <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="flex items-start gap-3">
          <Globe className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Helping others
            </h3>
            <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
              This Q&A is live in{" "}
              <Link href="/ask" className="underline hover:no-underline">
                Community Q&amp;A
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {currentSlug && (
              <Link
                href={`/ask/${currentSlug}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline dark:text-emerald-200"
              >
                <ExternalLink className="h-3 w-3" />
                View public page
              </Link>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleToggle("private")}
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              Make private
            </Button>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </section>
    );
  }

  // Private state — single-click share, tiny inline warning
  return (
    <section className="mt-6 rounded-2xl border bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Only you can see this</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Publish it to help others searching for the same answer. Review
            your question for personal info (name, email, phone) before
            sharing. Undo anytime.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => handleToggle("public")}
          disabled={isPending}
          className="gap-1.5"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Globe className="h-3.5 w-3.5" />
          )}
          Help others
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </section>
  );
}

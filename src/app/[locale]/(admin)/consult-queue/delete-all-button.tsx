"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAllConsults } from "@/lib/actions/consult-admin";

export function DeleteAllConsultsButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDeleteAll() {
    const ok = window.confirm(
      "Delete ALL consults and follow-ups? This cannot be undone. Use only for testing/QA."
    );
    if (!ok) return;

    startTransition(async () => {
      setError(null);
      const result = await deleteAllConsults();
      if (!result.ok) {
        setError(result.error ?? "Delete failed");
        return;
      }
      router.push("/consult-queue");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleDeleteAll}
        disabled={isPending}
        className="text-destructive hover:bg-destructive/10"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        Delete all
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

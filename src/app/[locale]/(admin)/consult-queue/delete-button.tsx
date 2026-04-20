"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteConsult } from "@/lib/actions/consult-admin";

export function DeleteConsultButton({ consultId }: { consultId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDelete() {
    const ok = window.confirm(
      "Delete this consult and its follow-ups? This cannot be undone."
    );
    if (!ok) return;

    startTransition(async () => {
      setError(null);
      const result = await deleteConsult(consultId);
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
        onClick={handleDelete}
        disabled={isPending}
        className="text-destructive hover:bg-destructive/10"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        Delete consult
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import {
  listAllExpertPicks,
  publishExpertPick,
  unpublishExpertPick,
  deleteExpertPick,
  type ExpertPickRow,
} from "@/lib/actions/expert-picks";

export default function ExpertAdminPage() {
  const [picks, setPicks] = useState<ExpertPickRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await listAllExpertPicks();
    setPicks(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handlePublish = async (id: number) => {
    await publishExpertPick(id);
    load();
  };

  const handleUnpublish = async (id: number) => {
    await unpublishExpertPick(id);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this expert pick?")) return;
    await deleteExpertPick(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Play className="h-6 w-6 text-primary" />
            Dr.&apos;s Analysis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            YouTube expert video analyses
          </p>
        </div>
        <Button render={<Link href="/expert-picks/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          Add Video
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">
          Loading...
        </div>
      ) : picks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Play className="mx-auto h-10 w-10 opacity-50" />
          <p className="mt-3">No expert picks yet</p>
          <p className="mt-1 text-sm">
            Add a YouTube URL to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {picks.map((pick) => (
            <div
              key={pick.id}
              className="flex items-center gap-4 rounded-lg border p-4"
            >
              {/* Thumbnail */}
              <div className="h-20 w-36 shrink-0 overflow-hidden rounded bg-muted">
                {pick.thumbnailUrl ? (
                  <img
                    src={pick.thumbnailUrl}
                    alt={pick.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Play className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-medium">{pick.title}</h3>
                  <Badge
                    variant={
                      pick.status === "published" ? "default" : "secondary"
                    }
                    className="shrink-0"
                  >
                    {pick.status}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {pick.expertName}
                  {pick.expertCredential && ` — ${pick.expertCredential}`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {pick.category} · {pick.duration ?? "N/A"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                {pick.status === "draft" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePublish(pick.id)}
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    Publish
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnpublish(pick.id)}
                  >
                    <EyeOff className="mr-1 h-3 w-3" />
                    Unpublish
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => handleDelete(pick.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

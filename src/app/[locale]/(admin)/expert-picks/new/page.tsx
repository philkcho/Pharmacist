"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  ArrowLeft,
  Loader2,
  Check,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { createExpertPick } from "@/lib/actions/expert-picks";

export default function NewExpertPickPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await createExpertPick(url.trim());

    if (result.success) {
      setSuccess(true);
      setTimeout(() => router.push("/expert-picks"), 1500);
    } else {
      setError(result.error ?? "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/expert-picks"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Play className="h-6 w-6 text-primary" />
          Add Expert Video
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a YouTube URL — we&apos;ll fetch the transcript and generate an
          AI analysis automatically.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="youtube-url"
            className="mb-1.5 block text-sm font-medium"
          >
            YouTube URL
          </label>
          <input
            id="youtube-url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950">
            <Check className="h-4 w-4 text-emerald-600" />
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Video analyzed and saved as draft. Redirecting...
            </p>
          </div>
        )}

        <Button type="submit" disabled={loading || !url.trim()} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching transcript &amp; analyzing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Fetch &amp; Analyze
            </>
          )}
        </Button>
      </form>

      {/* How it works */}
      <div className="rounded-lg border bg-muted/30 p-5">
        <h3 className="mb-3 text-sm font-semibold">How it works</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Badge variant="outline" className="mt-0.5 shrink-0 text-xs">
              1
            </Badge>
            <span>
              YouTube captions are downloaded automatically (video must have
              captions enabled)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Badge variant="outline" className="mt-0.5 shrink-0 text-xs">
              2
            </Badge>
            <span>
              AI analyzes the transcript — generates summary, key takeaways,
              and extracts mentioned products
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Badge variant="outline" className="mt-0.5 shrink-0 text-xs">
              3
            </Badge>
            <span>
              Saved as draft — review and publish when ready
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}

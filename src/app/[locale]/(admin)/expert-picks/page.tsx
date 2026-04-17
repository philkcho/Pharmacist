"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Pill,
} from "lucide-react";
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
    if (!confirm("Delete this expert analysis?")) return;
    await deleteExpertPick(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="h-6 w-6 text-primary" />
            Dr.&apos;s Analysis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Expert-backed articles with analysis and product recommendations
          </p>
        </div>
        <Button render={<Link href="/expert-picks/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          New Analysis
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">
          Loading...
        </div>
      ) : picks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <FileText className="mx-auto h-10 w-10 opacity-50" />
          <p className="mt-3">No analyses yet</p>
          <p className="mt-1 text-sm">
            Create your first expert-backed analysis to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map((pick) => (
            <ExpertPickAdminCard
              key={pick.id}
              pick={pick}
              onPublish={() => handlePublish(pick.id)}
              onUnpublish={() => handleUnpublish(pick.id)}
              onDelete={() => handleDelete(pick.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpertPickAdminCard({
  pick,
  onPublish,
  onUnpublish,
  onDelete,
}: {
  pick: ExpertPickRow;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
}) {
  const categoryLabel =
    pick.category === "health"
      ? "Health"
      : pick.category === "skin-care"
        ? "Skin Care"
        : "Wellness";

  // published 카드는 홈페이지처럼 전체를 클릭해 상세 페이지로 이동,
  // draft는 미리보기 불가 — 커버/제목은 일반 블록으로 렌더
  const isPublished = pick.status === "published";
  const CoverWrapper: React.ElementType = isPublished ? Link : "div";
  const coverProps = isPublished
    ? { href: `/expert/${pick.slug}`, target: "_blank" as const }
    : {};

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-background transition-all hover:border-primary/30 hover:shadow-md">
      {/* Title on top + compact brand strip (published일 때 전체 클릭 가능) */}
      <CoverWrapper {...coverProps} className="block flex-1">
        <div className="p-4">
          <div className="mb-2 flex items-center gap-1">
            <Badge
              variant={isPublished ? "default" : "secondary"}
              className="text-xs"
            >
              {pick.status}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {categoryLabel}
            </Badge>
            {isPublished && (
              <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <h3
            className={`line-clamp-3 font-semibold leading-snug ${
              isPublished ? "group-hover:text-primary" : ""
            }`}
          >
            {pick.title}
          </h3>
        </div>
        <div className="mt-auto flex items-center justify-center gap-1.5 border-t bg-primary/5 px-3 py-2">
          <Pill className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dr.&apos;s Analysis
          </span>
        </div>
      </CoverWrapper>

      {/* Actions (별도 영역 — 카드 링크와 분리) */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2">
          {pick.status === "draft" ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={onPublish}
            >
              <Eye className="mr-1 h-3 w-3" />
              Publish
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={onUnpublish}
            >
              <EyeOff className="mr-1 h-3 w-3" />
              Unpublish
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

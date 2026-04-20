import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { DrCover } from "./dr-cover";

interface ArticleHeroProps {
  title: string;
  category: string;
  categoryLabel: string;
  readMinutes: number;
  thumbnailUrl?: string | null;
  fallbackCover?: React.ReactNode;
}

// Magazine-style hero: full-bleed cover with dark gradient overlay and
// title/category/read-time laid over the bottom. Falls back to DrCover
// gradient when no thumbnail is available (older picks without a generated
// image). Uses Image `priority` so the hero drives LCP on this page.
export function ArticleHero({
  title,
  category,
  categoryLabel,
  readMinutes,
  thumbnailUrl,
  fallbackCover,
}: ArticleHeroProps) {
  return (
    <div className="relative h-[180px] w-full overflow-hidden sm:h-[220px] lg:h-[260px]">
      {thumbnailUrl ? (
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0">
          {fallbackCover ?? <DrCover category={category} />}
        </div>
      )}

      {/* Dark bottom-to-top gradient so white text is readable regardless
          of the underlying image content (including AI-generated people). */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/10" />

      {/* Overlay content — anchored to bottom, centered max-width */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto max-w-3xl px-4 pb-4 sm:px-6 sm:pb-5 lg:pb-6">
          <Badge
            variant="secondary"
            className="mb-2 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25"
          >
            {categoryLabel}
          </Badge>
          <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-white drop-shadow-sm sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-white/80">
            <Clock className="h-3.5 w-3.5" />
            <span>~{readMinutes} min read</span>
          </div>
        </div>
      </div>
    </div>
  );
}

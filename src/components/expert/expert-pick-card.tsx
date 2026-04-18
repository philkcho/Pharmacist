import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { DrCover } from "./dr-cover";
import { AuthorAvatar } from "./author-avatar";
import { SITE_AUTHOR } from "@/lib/author";

const CATEGORY_LABELS: Record<string, string> = {
  health: "Health",
  "skin-care": "Skin Care",
  wellness: "Wellness",
};

interface ExpertPickCardProps {
  slug: string;
  title: string;
  category: string;
  thumbnailUrl?: string | null;
}

export function ExpertPickCard({
  slug,
  title,
  category,
  thumbnailUrl,
}: ExpertPickCardProps) {
  const label = CATEGORY_LABELS[category] ?? "Analysis";

  return (
    <Link
      href={`/expert/${slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-background transition-all hover:border-primary/30 hover:shadow-md"
    >
      {/* Cover — real topic photo if present, else category-gradient Dr.pharmacist cover */}
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <DrCover category={category} />
        )}

        {/* Author avatar — bottom-right overlay, signals E-E-A-T */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-background/90 py-1 pl-1 pr-2.5 shadow-sm backdrop-blur">
          <AuthorAvatar size={24} ringClassName="" />
          <span className="text-[10px] font-medium leading-none text-foreground">
            {SITE_AUTHOR.shortCredit}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <Badge variant="secondary" className="mb-2 text-xs">
          {label}
        </Badge>
        <h3 className="line-clamp-3 font-semibold leading-snug group-hover:text-primary">
          {title}
        </h3>
      </div>
    </Link>
  );
}

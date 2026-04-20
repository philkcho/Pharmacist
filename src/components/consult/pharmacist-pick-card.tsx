import Link from "next/link";
import Image from "next/image";
import { Pill, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SITE_AUTHOR } from "@/lib/author";
import type { EnrichedRecommendation } from "@/lib/actions/consult-recommendations";

const TYPE_LABEL: Record<string, string> = {
  otc_drug: "OTC",
  supplement: "Supplement",
  cosmetic: "Skin Care",
  quasi_drug: "Medicated",
};

interface Props {
  recommendation: EnrichedRecommendation;
}

// Dr.'s Pick-styled recommendation card for /consult/[id].
// Mirrors the visual hierarchy of ExpertPickCard so users immediately
// recognize the same trusted format used throughout the site.
export function PharmacistPickCard({ recommendation }: Props) {
  const { name, slug, reason, imageUrl, verdict, productType } = recommendation;
  const label = productType ? (TYPE_LABEL[productType] ?? "Product") : "Product";

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-background transition-all hover:border-primary/30 hover:shadow-md">
      {/* Cover */}
      <Link
        href={`/analysis/${slug}`}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-muted"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Pill className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        {/* Reviewer credit overlay */}
        <div className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-medium leading-none text-foreground shadow-sm backdrop-blur">
          Reviewed by {SITE_AUTHOR.name}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Badge variant="secondary" className="mb-2 w-fit text-xs">
          {label}
        </Badge>

        <Link href={`/analysis/${slug}`}>
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">
            {name}
          </h3>
        </Link>

        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
          {reason}
        </p>

        {verdict && (
          <p className="mt-2 line-clamp-2 text-xs italic text-muted-foreground/80">
            “{verdict}”
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-3">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            render={<Link href={`/analysis/${slug}`} />}
          >
            View Analysis
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1"
            render={<Link href={`/topics/${slug}`} />}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Shop
          </Button>
        </div>
      </div>
    </article>
  );
}

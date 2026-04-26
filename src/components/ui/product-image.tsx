"use client";

import { useState } from "react";
import { Pill } from "lucide-react";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  /** Unused today — kept for API compatibility with existing callers.
   *  Previously used to synthesize a Pollinations fallback image, which
   *  we removed because AI images don't match the real product. */
  productName?: string;
  productType?: string;
  className?: string;
  fallbackClassName?: string;
  iconSize?: number;
  /** When the caller knows this image is the LCP candidate (first card
   *  in the viewport), set `priority` so the browser fetches eagerly with
   *  high fetchPriority. Default is lazy + async decode so a long list of
   *  ProductImages doesn't compete with above-the-fold paints. */
  priority?: boolean;
}

/**
 * Image with single-tier fallback:
 *   1. primary `src` (real product photo from Google CSE / retailer CDN)
 *   2. Pill icon placeholder on error or when src is missing
 *
 * No AI-generated fallback — a misleading photo of the wrong product is
 * worse than an honest placeholder.
 */
export function ProductImage({
  src,
  alt,
  className,
  fallbackClassName,
  iconSize = 40,
  priority = false,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={
          fallbackClassName ??
          "flex h-full w-full items-center justify-center bg-muted"
        }
      >
        <Pill
          className="text-muted-foreground/30"
          style={{ width: iconSize, height: iconSize }}
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}

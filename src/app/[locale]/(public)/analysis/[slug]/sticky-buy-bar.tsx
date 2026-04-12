"use client";

import { ShoppingCart, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StickyBuyBarProps {
  productName: string;
  retailers: Array<{ name: string; url: string; emoji: string }>;
  purchaseOptions: Array<{
    linkId: number;
    retailerName: string;
    url: string;
  }>;
}

export function StickyBuyBar({
  productName,
  retailers,
  purchaseOptions,
}: StickyBuyBarProps) {
  // Prefer purchase options (tracked links) over raw search URLs
  const links =
    purchaseOptions.length > 0
      ? purchaseOptions.map((p) => ({
          label: p.retailerName,
          href: `/api/click/${p.linkId}?ref=analysis_page`,
        }))
      : retailers.map((r) => ({
          label: `${r.emoji} ${r.name}`,
          href: r.url,
        }));

  if (links.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
        <div className="mr-auto hidden min-w-0 sm:block">
          <p className="truncate text-sm font-medium">{productName}</p>
          <p className="text-xs text-muted-foreground">
            Select a retailer to purchase
          </p>
        </div>
        <ShoppingCart className="h-5 w-5 shrink-0 text-primary sm:hidden" />
        <div className="flex flex-1 items-center gap-2 overflow-x-auto sm:flex-none">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="default" className="shrink-0">
                {link.label}
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

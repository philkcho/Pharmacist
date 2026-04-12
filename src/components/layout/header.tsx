import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pill } from "lucide-react";
import { HeaderSearchBar } from "./header-search-bar";

export function Header() {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Pill className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">
            {t("site.name")}
          </span>
        </Link>

        {/* Search bar — grows to fill available space */}
        <div className="hidden flex-1 sm:block">
          <HeaderSearchBar />
        </div>

        <nav className="flex shrink-0 items-center gap-4 text-sm font-medium">
          <Link
            href="/trending"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Trending
          </Link>
          <Link
            href="/about"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav.about")}
          </Link>
        </nav>
      </div>

      {/* Mobile search bar — full width below header */}
      <div className="border-t px-4 py-2 sm:hidden">
        <HeaderSearchBar />
      </div>
    </header>
  );
}

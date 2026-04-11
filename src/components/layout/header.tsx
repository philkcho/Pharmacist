import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pill } from "lucide-react";

export function Header() {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Pill className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">
            {t("site.name")}
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link
            href="/"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav.home")}
          </Link>
          <Link
            href="/about"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav.about")}
          </Link>
        </nav>
      </div>
    </header>
  );
}

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LogIn, Pill } from "lucide-react";
import { HeaderSearchBar } from "./header-search-bar";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  showAdmin?: boolean;
  userEmail?: string | null;
}

export function Header({ showAdmin, userEmail }: HeaderProps) {
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
          {showAdmin && (
            <Link
              href="/dashboard"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Admin
            </Link>
          )}
          <Link
            href="/ask"
            className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Community Q&amp;A
          </Link>
          {userEmail && (
            <Link
              href="/consult"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              My questions
            </Link>
          )}
          <Link
            href="/about"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav.about")}
          </Link>

          {userEmail ? (
            <div className="flex items-center gap-2">
              <span
                className="hidden max-w-[140px] truncate text-xs text-muted-foreground md:inline"
                title={userEmail}
              >
                {userEmail}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              render={<Link href="/login" />}
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </Button>
          )}
        </nav>
      </div>

      {/* Mobile search bar — full width below header */}
      <div className="border-t px-4 py-2 sm:hidden">
        <HeaderSearchBar />
      </div>
    </header>
  );
}

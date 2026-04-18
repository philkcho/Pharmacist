import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pill } from "lucide-react";
import { SITE_AUTHOR } from "@/lib/author";

export function Footer() {
  const t = useTranslations();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* FDA Disclaimer */}
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <p className="font-medium">Medical Disclaimer</p>
          <p className="mt-1 leading-relaxed">{t("footer.disclaimer")}</p>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Medically reviewed by{" "}
          <Link href="/about" className="text-foreground hover:underline">
            {SITE_AUTHOR.name}
          </Link>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t("footer.copyright", { year: currentYear })}
            </span>
          </div>

          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/editorial" className="hover:text-foreground">
              Editorial Process
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

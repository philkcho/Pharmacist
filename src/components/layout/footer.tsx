import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pill, Bell } from "lucide-react";
import { SITE_AUTHOR } from "@/lib/author";
import { FooterSubscribe } from "@/components/subscribe/footer-subscribe";

export function Footer() {
  const t = useTranslations();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Weekly picks subscribe */}
        <div className="mb-6 flex flex-col items-start gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">
                Get pharmacist-curated picks
              </p>
              <p className="text-sm text-muted-foreground">
                Weekly digest of trending health & beauty products. No spam.
              </p>
            </div>
          </div>
          <FooterSubscribe />
        </div>

        {/* FDA Disclaimer */}
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Medical Disclaimer</p>
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

          <nav className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/disclosure" className="hover:text-foreground">
              Affiliate Disclosure
            </Link>
            <Link href="/about" className="hover:text-foreground">
              About
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

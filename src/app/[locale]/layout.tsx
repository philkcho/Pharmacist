import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { PageTracker } from "@/components/analytics/page-tracker";
import { OrganizationJsonLd } from "@/components/seo/json-ld";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

export const metadata: Metadata = {
  title: {
    default: "Dr.pharmacist — Expert OTC Medication Recommendations",
    template: "%s | Dr.pharmacist",
  },
  description:
    "Pharmacist-reviewed health & beauty analysis. Evidence-based product reviews, ingredient breakdowns, and safety data from FDA, PubMed, and FAERS.",
  metadataBase: new URL(SITE_URL),
  applicationName: "Dr.pharmacist",
  authors: [{ name: "Dr.pharmacist" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Dr.pharmacist",
    title: "Dr.pharmacist — Evidence-Based Health & Beauty Analysis",
    description:
      "Pharmacist-reviewed product analysis backed by FDA data, clinical research, and ingredient science.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Dr.pharmacist",
    description:
      "We read the science so you don't have to. Pharmacist-reviewed health & beauty analysis.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  verification: {
    google: "3WA8CWhVp2X3YIMf-j8y-szdsEo-3Jds8TZcP-8Ae-Q",
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <OrganizationJsonLd />
        <NextIntlClientProvider>
          <PageTracker />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

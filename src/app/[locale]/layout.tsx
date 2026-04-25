import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { PageTracker } from "@/components/analytics/page-tracker";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/json-ld";
import { BRAND } from "@/lib/brand";
import { SITE_AUTHOR } from "@/lib/author";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — Evidence-Based Health & Beauty Analysis`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.shortDescription,
  metadataBase: new URL(BRAND.url),
  applicationName: BRAND.name,
  authors: [{ name: SITE_AUTHOR.displayName }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: BRAND.name,
    title: `${BRAND.name} — Evidence-Based Health & Beauty Analysis`,
    description: BRAND.shortDescription,
    url: BRAND.url,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
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
  appleWebApp: {
    capable: true,
    title: "PharmCare",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  // iOS Safari: when the URL/tab bar slides in/out, fixed bottom-0
  // elements can get hidden behind it. interactiveWidget=resizes-content
  // tells Safari to resize the layout viewport so fixed elements stay
  // glued to the *visible* bottom in both scroll directions.
  interactiveWidget: "resizes-content",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-x-clip antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-clip">
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <NextIntlClientProvider>
          <PageTracker />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

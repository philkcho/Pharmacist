import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.pollinations.ai" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "rlemyrdivdwibooxbugq.supabase.co" },
    ],
  },
};

export default withNextIntl(nextConfig);

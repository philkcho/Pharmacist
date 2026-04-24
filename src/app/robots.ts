import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aipharmcare.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/approval-queue",
          "/consult-queue",
          "/review-requests",
          "/expert-picks",  // admin expert-picks, not /expert/
          "/retailers",
          "/medications",
          "/categories",
          "/trends",
          "/analytics",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

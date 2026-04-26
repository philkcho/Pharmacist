import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = `${BRAND.name} — Pharmacist-Reviewed Health & Beauty Analysis`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default OG/Twitter card for the homepage and any descendant page that
// doesn't override it. Renders at request time on the edge so brand copy
// stays in sync with src/lib/brand.ts without shipping a static asset.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "linear-gradient(135deg, #f0fdfa 0%, #ffffff 55%, #ecfeff 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "#0d9488",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "44px",
              fontWeight: 700,
            }}
          >
            ℞
          </div>
          <div
            style={{
              fontSize: "44px",
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            {BRAND.name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            We read the science
            <br />
            so you don&apos;t have to.
          </div>
          <div
            style={{
              fontSize: "30px",
              color: "#475569",
              lineHeight: 1.35,
              maxWidth: "950px",
            }}
          >
            Pharmacist-reviewed supplements, OTC medications, and skincare —
            backed by FDA data and clinical research.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "22px",
            color: "#64748b",
          }}
        >
          <span>Reviewed by Younghun Cho, PharmD</span>
          <span style={{ color: "#0d9488", fontWeight: 600 }}>
            aipharmcare.com
          </span>
        </div>
      </div>
    ),
    size
  );
}

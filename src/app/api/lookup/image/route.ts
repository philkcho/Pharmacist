import { NextResponse } from "next/server";
import {
  identifyProductFromImage,
  type ProductIdentification,
} from "@/lib/ai/identify-product";
import { lookupProduct, type LookupResult } from "@/lib/actions/lookup";

export const maxDuration = 60;

/**
 * Maximum base64 payload size we'll accept (~3 MB raw image).
 * Client resizes before upload, so this is a safety net only.
 */
const MAX_BASE64_SIZE = 4 * 1024 * 1024; // ~3 MB raw image after base64 overhead

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface ImageLookupRequest {
  imageBase64: string;
  mimeType: string;
}

interface ImageLookupResponse {
  identification: ProductIdentification;
  lookupResult: LookupResult;
}

export async function POST(req: Request) {
  let body: ImageLookupRequest;
  try {
    body = (await req.json()) as ImageLookupRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { imageBase64, mimeType } = body;

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported image type. Use: ${Array.from(ALLOWED_MIME_TYPES).join(", ")}` },
      { status: 400 }
    );
  }
  if (imageBase64.length > MAX_BASE64_SIZE) {
    return NextResponse.json(
      { error: "Image is too large. Please use a smaller photo." },
      { status: 413 }
    );
  }

  try {
    // 1. Gemini vision — identify the product from visible packaging
    const identification = await identifyProductFromImage(imageBase64, mimeType);

    // 2. If confident, chain to the existing text lookup pipeline
    //    (DB → openFDA). This reuses all the server-side work we
    //    already did for the text search path, including logging
    //    the attempt to product_lookups.
    let lookupResult: LookupResult;
    if (identification.confidence !== "none" && identification.productName) {
      lookupResult = await lookupProduct(identification.productName);
    } else {
      // Low / no confidence — don't pretend we know what this is.
      lookupResult = {
        type: "miss",
        lookupId: null,
        query: identification.productName || "(unrecognized image)",
        message:
          "We couldn't confidently identify an OTC product in that photo. Try a clearer shot of the label or search by product name instead.",
      };
    }

    const response: ImageLookupResponse = { identification, lookupResult };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[lookup/image] error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Image lookup failed",
      },
      { status: 500 }
    );
  }
}

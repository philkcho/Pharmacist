/**
 * Anonymous-friendly photo upload for Personal Consult.
 *
 * Visitors don't have to be signed in to submit a consult, so this
 * endpoint accepts uploads without auth. We use the admin Supabase
 * client to bypass storage RLS and put the file in the public
 * `public-images` bucket under a `consults/` folder.
 *
 * Basic limits enforced inline:
 *   - max 5 MB per file
 *   - image/* MIME types only
 *   - random file name (no PII from client filename)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are allowed" },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 5 MB)" },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)
    ? ext
    : "jpg";

  const random = crypto.randomUUID();
  const path = `consults/${random}.${safeExt}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("public-images")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("public-images").getPublicUrl(data.path);

  return NextResponse.json({ url: publicUrl, path: data.path });
}

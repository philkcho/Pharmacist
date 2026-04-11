import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Estimate reading time
  const wordCount = (body.content ?? "").split(/\s+/).length;
  const reading_time_minutes = Math.max(1, Math.round(wordCount / 200));

  // Auto-generate excerpt if empty
  const excerpt =
    body.excerpt ||
    (body.content ?? "")
      .replace(/[#*>\-\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

  const { data, error } = await supabase
    .from("articles")
    .insert({
      title: body.title,
      slug: body.slug,
      excerpt,
      content: body.content,
      status: body.status ?? "draft",
      category_id: body.category_id,
      author_id: user.id,
      seo_title: body.seo_title ?? body.title,
      seo_description: body.seo_description ?? excerpt,
      is_ai_drafted: body.is_ai_drafted ?? false,
      ai_model: body.ai_model ?? null,
      article_references: body.references ?? [],
      product_cards: body.product_cards ?? [],
      reading_time_minutes,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

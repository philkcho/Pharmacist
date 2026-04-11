import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("articles")
    .select(
      "*, category:categories!category_id(id, name, slug), author:pharmacist_profiles!author_id(id, display_name, slug, title)"
    )
    .eq("id", parseInt(id))
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const wordCount = (body.content ?? "").split(/\s+/).length;
  const reading_time_minutes = Math.max(1, Math.round(wordCount / 200));

  const updateData: Record<string, unknown> = {
    title: body.title,
    slug: body.slug,
    excerpt: body.excerpt,
    content: body.content,
    status: body.status,
    category_id: body.category_id,
    seo_title: body.seo_title,
    seo_description: body.seo_description,
    article_references: body.references ?? [],
    product_cards: body.product_cards ?? [],
    reading_time_minutes,
  };

  if (body.status === "published") {
    updateData.published_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("articles")
    .update(updateData)
    .eq("id", parseInt(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("articles")
    .delete()
    .eq("id", parseInt(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

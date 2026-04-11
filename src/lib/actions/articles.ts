"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getArticles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*, category:categories(name, slug), author:pharmacist_profiles!author_id(display_name, slug)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getArticleById(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*, category:categories(name, slug), author:pharmacist_profiles!author_id(display_name, slug, title)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getArticleBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*, category:categories(name, slug), author:pharmacist_profiles!author_id(display_name, slug, title, bio)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error) return null;
  return data;
}

export async function getPublishedArticles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug, excerpt, status, published_at, reading_time_minutes, category:categories(name, slug), author:pharmacist_profiles!author_id(display_name, slug)")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getArticlesByCategory(categorySlug: string) {
  const supabase = await createClient();

  // First get category
  const { data: category, error: catError } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", categorySlug)
    .single();

  if (catError) return { category: null, articles: [] };

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, title, slug, excerpt, published_at, reading_time_minutes, author:pharmacist_profiles!author_id(display_name)")
    .eq("category_id", category.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) throw new Error(error.message);
  return { category, articles: articles ?? [] };
}

export async function createArticle(formData: {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category_id: number | null;
  author_id: string;
  seo_title: string;
  seo_description: string;
  status: string;
  is_ai_drafted?: boolean;
  ai_model?: string;
}) {
  const supabase = await createClient();

  // Estimate reading time (~200 words per minute)
  const wordCount = formData.content.split(/\s+/).length;
  const reading_time_minutes = Math.max(1, Math.round(wordCount / 200));

  const { data, error } = await supabase
    .from("articles")
    .insert({ ...formData, reading_time_minutes })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/articles");
  revalidatePath("/");
  return data;
}

export async function updateArticle(
  id: number,
  formData: {
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: string;
    category_id?: number | null;
    seo_title?: string;
    seo_description?: string;
    status?: string;
  }
) {
  const supabase = await createClient();

  // Recalculate reading time if content changed
  const updateData: Record<string, unknown> = { ...formData };
  if (formData.content) {
    const wordCount = formData.content.split(/\s+/).length;
    updateData.reading_time_minutes = Math.max(1, Math.round(wordCount / 200));
  }

  const { error } = await supabase
    .from("articles")
    .update(updateData)
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/articles");
  revalidatePath("/");
}

export async function deleteArticle(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("articles").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/articles");
}

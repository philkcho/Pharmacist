"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");

  if (error) throw new Error(error.message);
  return data;
}

export async function createCategory(formData: {
  name: string;
  slug: string;
  description: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert(formData);

  if (error) throw new Error(error.message);
  revalidatePath("/categories");
}

export async function updateCategory(
  id: number,
  formData: { name: string; slug: string; description: string }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update(formData)
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/categories");
}

export async function deleteCategory(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/categories");
}

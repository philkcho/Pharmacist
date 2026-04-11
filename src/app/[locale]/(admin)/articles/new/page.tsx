import { getCategories } from "@/lib/actions/categories";
import { getSession } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { NewArticleClient } from "./new-article-client";

export default async function NewArticlePage() {
  const [categories, user] = await Promise.all([
    getCategories(),
    getSession(),
  ]);

  if (!user) redirect("/login");

  return <NewArticleClient categories={categories} authorId={user.id} />;
}

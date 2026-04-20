import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

// All answers now render inline on /consult (one-page design).
// Kept as a redirect so existing bookmarks / emails still resolve.
export default async function ConsultDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/consult#${id}`);
}

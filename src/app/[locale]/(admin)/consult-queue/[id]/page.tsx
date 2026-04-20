import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Legacy detail route — the queue is now an inbox-style split layout
// at /consult-queue?id=xxx. Bookmarks to /consult-queue/[id] still work.
export default async function ConsultLegacyDetail({ params }: PageProps) {
  const { id } = await params;
  redirect(`/consult-queue?id=${id}`);
}

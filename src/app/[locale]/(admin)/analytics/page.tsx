import { redirect } from "next/navigation";

// Analytics was merged into /dashboard. This route stays as a redirect so any
// bookmarks or external links still land in the right place.
export default function AnalyticsPage() {
  redirect("/dashboard");
}

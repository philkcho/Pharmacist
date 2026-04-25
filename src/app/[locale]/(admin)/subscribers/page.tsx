import { listSubscribers } from "@/lib/actions/subscribers";
import { SubscribersClient } from "./subscribers-client";

export default async function SubscribersPage() {
  const snapshot = await listSubscribers();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Email Subscribers</h1>
        <p className="mt-2 text-muted-foreground">
          Anyone who signed up for the digest. Manage frequency, unsubscribe,
          or remove records here.
        </p>
      </div>
      <SubscribersClient initialSnapshot={snapshot} />
    </div>
  );
}

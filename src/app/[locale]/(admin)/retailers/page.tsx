import { listRetailers } from "@/lib/actions/retailers";
import { RetailersClient } from "./retailers-client";

export default async function RetailersPage() {
  const retailers = await listRetailers();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Retailers</h1>
        <p className="mt-2 text-muted-foreground">
          Manage retail partners and affiliate programs for product purchase
          links.
        </p>
      </div>
      <RetailersClient initialRetailers={retailers} />
    </div>
  );
}

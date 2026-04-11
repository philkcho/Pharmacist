import { getMedications } from "@/lib/actions/medications";
import { getCategories } from "@/lib/actions/categories";
import { MedicationsClient } from "./medications-client";

export default async function MedicationsPage() {
  const [medications, categories] = await Promise.all([
    getMedications(),
    getCategories(),
  ]);

  return (
    <MedicationsClient
      initialMedications={medications}
      categories={categories}
    />
  );
}

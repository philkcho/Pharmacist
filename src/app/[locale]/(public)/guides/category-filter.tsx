"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryOption {
  id: number;
  slug: string;
  name: string;
}

interface CategoryFilterProps {
  categories: CategoryOption[];
  selected: string;
}

const ALL_VALUE = "__all__";

export function CategoryFilter({ categories, selected }: CategoryFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL_VALUE) {
      params.delete("category");
    } else {
      params.set("category", value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <Select value={selected || ALL_VALUE} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder="All categories" />
      </SelectTrigger>
      <SelectContent className="min-w-56">
        <SelectItem value={ALL_VALUE}>All categories</SelectItem>
        {categories.map((cat) => (
          <SelectItem key={cat.id} value={cat.slug}>
            {cat.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

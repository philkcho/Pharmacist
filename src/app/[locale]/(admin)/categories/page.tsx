"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

// TODO: Replace with Supabase data
const initialCategories = [
  { id: 1, name: "Pain Relief", slug: "pain-relief", description: "OTC pain relievers and anti-inflammatory medications", articleCount: 0 },
  { id: 2, name: "Cold & Flu", slug: "cold-flu", description: "Cold medicine, decongestants, and flu remedies", articleCount: 0 },
  { id: 3, name: "Digestive Health", slug: "digestive-health", description: "Antacids, probiotics, and digestive aids", articleCount: 0 },
  { id: 4, name: "Allergy", slug: "allergy", description: "Antihistamines and allergy relief medications", articleCount: 0 },
  { id: 5, name: "Vitamins & Supplements", slug: "vitamins-supplements", description: "Daily vitamins, minerals, and dietary supplements", articleCount: 0 },
  { id: 6, name: "Skin Care", slug: "skin-care", description: "Topical treatments, moisturizers, and skin health", articleCount: 0 },
  { id: 7, name: "Sleep & Relaxation", slug: "sleep-relaxation", description: "Sleep aids and calming supplements", articleCount: 0 },
  { id: 8, name: "First Aid", slug: "first-aid", description: "Wound care, antiseptics, and first aid supplies", articleCount: 0 },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState(initialCategories);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<typeof initialCategories[0] | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const generateSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleOpenNew = () => {
    setEditingCategory(null);
    setName("");
    setSlug("");
    setDescription("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (cat: typeof initialCategories[0]) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description);
    setDialogOpen(true);
  };

  const handleSave = () => {
    // TODO: Save to Supabase
    if (editingCategory) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategory.id ? { ...c, name, slug, description } : c
        )
      );
    } else {
      const newCat = {
        id: Math.max(...categories.map((c) => c.id)) + 1,
        name,
        slug,
        description,
        articleCount: 0,
      };
      setCategories((prev) => [...prev, newCat]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: number) => {
    // TODO: Delete from Supabase
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button onClick={handleOpenNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Articles</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell className="text-muted-foreground">{cat.slug}</TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                  {cat.description}
                </TableCell>
                <TableCell>{cat.articleCount}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleOpenEdit(cat)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(cat.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "New Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catName">Name</Label>
              <Input
                id="catName"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingCategory) setSlug(generateSlug(e.target.value));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catSlug">Slug</Label>
              <Input
                id="catSlug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catDesc">Description</Label>
              <Textarea
                id="catDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <Button onClick={handleSave} className="w-full">
              {editingCategory ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  Store,
  Globe,
} from "lucide-react";
import {
  createRetailer,
  deleteRetailer,
  type RetailerRow,
} from "@/lib/actions/retailers";

interface RetailersClientProps {
  initialRetailers: RetailerRow[];
}

export function RetailersClient({ initialRetailers }: RetailersClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formCountry, setFormCountry] = useState("US");
  const [formNetwork, setFormNetwork] = useState("");
  const [formCommission, setFormCommission] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(name: string) {
    setFormName(name);
    // Auto-generate slug from name
    setFormSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "-")
    );
  }

  function handleAdd() {
    if (!formName.trim() || !formUrl.trim()) {
      setError("Name and website URL are required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createRetailer({
        name: formName.trim(),
        slug: formSlug.trim() || formName.toLowerCase().replace(/\s+/g, "-"),
        websiteUrl: formUrl.trim(),
        country: formCountry,
        affiliateNetwork: formNetwork.trim() || undefined,
        commissionRate: formCommission ? parseFloat(formCommission) : undefined,
      });
      if (result.ok) {
        setShowAdd(false);
        setFormName("");
        setFormSlug("");
        setFormUrl("");
        setFormCountry("US");
        setFormNetwork("");
        setFormCommission("");
        router.refresh();
      } else {
        setError(result.error ?? "Failed to create retailer");
      }
    });
  }

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This will remove all purchase links for this retailer.`)) return;
    startTransition(async () => {
      await deleteRetailer(id);
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Retail Partners ({initialRetailers.length})
          </CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Retailer
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Affiliate</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialRetailers.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      <a
                        href={r.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {r.slug}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      <Globe className="mr-1 h-3 w-3" />
                      {r.country}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.affiliateNetwork ? (
                      <Badge variant="secondary" className="text-xs">
                        {r.affiliateNetwork}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.commissionRate ? (
                      <span className="text-sm">{r.commissionRate}%</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(r.id, r.name)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {initialRetailers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No retailers yet. Add your first retail partner.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Retailer Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Retailer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Olive Young"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="olive-young"
              />
            </div>
            <div>
              <Label>Website URL</Label>
              <Input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://www.oliveyoung.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Country</Label>
                <Input
                  value={formCountry}
                  onChange={(e) => setFormCountry(e.target.value)}
                  placeholder="US"
                  maxLength={2}
                />
              </div>
              <div>
                <Label>Commission Rate (%)</Label>
                <Input
                  type="number"
                  value={formCommission}
                  onChange={(e) => setFormCommission(e.target.value)}
                  placeholder="5.00"
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <Label>Affiliate Network</Label>
              <Input
                value={formNetwork}
                onChange={(e) => setFormNetwork(e.target.value)}
                placeholder="e.g. amazon_associates, impact, coupang_partners"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Retailer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

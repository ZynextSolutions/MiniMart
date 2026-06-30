"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { BrandFormDialog } from "./brand-form-dialog";
import {
  deleteBrandAction,
  listBrandsAction,
} from "@/features/brands/actions/brand.actions";

interface BrandRow {
  id: string;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  _count: { products: number };
}

interface BrandsPageClientProps {
  initialBrands: BrandRow[];
}

export function BrandsPageClient({ initialBrands }: BrandsPageClientProps) {
  const [brands, setBrands] = useState(initialBrands);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function refreshBrands() {
    const result = await listBrandsAction();
    setBrands(result as BrandRow[]);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteBrandAction(deleteId);
    if (result.success) {
      toast.success("Brand deleted");
      await refreshBrands();
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
          <p className="text-muted-foreground">{brands.length} brands total</p>
        </div>
        <Button onClick={() => { setEditingBrand(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Brand
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No brands found.
                </TableCell>
              </TableRow>
            ) : (
              brands.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell className="font-medium">{brand.name}</TableCell>
                  <TableCell>{brand._count.products}</TableCell>
                  <TableCell>
                    <Badge variant={brand.isActive ? "default" : "secondary"}>
                      {brand.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingBrand(brand);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(brand.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <BrandFormDialog
        key={editingBrand?.id ?? "new-brand"}
        open={formOpen}
        onOpenChange={setFormOpen}
        brand={editingBrand}
        onSuccess={refreshBrands}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete brand"
        description="This brand will be removed from the catalog."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

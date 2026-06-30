"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatMoney } from "@/lib/utils/format";
import { deleteProductAction } from "@/features/products/actions/product.actions";

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  sellingPrice: string;
  isActive: boolean;
  category: { name: string } | null;
  brand: { name: string } | null;
  unit: { abbreviation: string };
  images: { url: string }[];
  barcodes: { code: string }[];
}

interface ProductsPageClientProps {
  products: ProductRow[];
  total: number;
  page: number;
  totalPages: number;
  categories: { id: string; name: string; parentId: string | null }[];
  brands: { id: string; name: string }[];
  initialSearch: string;
}

export function ProductsPageClient({
  products,
  page,
  totalPages,
  initialSearch,
}: ProductsPageClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    router.push(`/products?${params.toString()}`);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteProductAction(deleteId);
    if (result.success) {
      toast.success("Product deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  }

  return (
    <>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, SKU, barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.images[0] ? (
                      <Image
                        src={product.images[0].url}
                        alt={product.name}
                        width={40}
                        height={40}
                        className="rounded object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category?.name ?? "—"}</TableCell>
                  <TableCell>{formatMoney(product.sellingPrice)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {product.barcodes[0]?.code ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? "default" : "secondary"}>
                      {product.isActive ? "Active" : "Inactive"}
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
                        <DropdownMenuItem asChild>
                          <Link href={`/products/${product.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(product.id)}
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

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => router.push(`/products?page=${page - 1}`)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => router.push(`/products?page=${page + 1}`)}
          >
            Next
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete product"
        description="This will remove the product from the catalog."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}

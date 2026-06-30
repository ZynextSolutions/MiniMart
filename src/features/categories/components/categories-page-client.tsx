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
import { CategoryFormDialog } from "./category-form-dialog";
import {
  deleteCategoryAction,
  listCategoriesAction,
} from "@/features/categories/actions/category.actions";

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  parent: { id: string; name: string } | null;
  _count: { products: number; children: number };
}

interface CategoriesPageClientProps {
  initialCategories: CategoryRow[];
  parentOptions: { id: string; name: string; parentId: string | null }[];
}

export function CategoriesPageClient({
  initialCategories,
  parentOptions,
}: CategoriesPageClientProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function refreshCategories() {
    const result = await listCategoriesAction();
    setCategories(result as CategoryRow[]);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteCategoryAction(deleteId);
    if (result.success) {
      toast.success("Category deleted");
      await refreshCategories();
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">{categories.length} categories total</p>
        </div>
        <Button onClick={() => { setEditingCategory(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Subcategories</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No categories found.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category.parent?.name ?? "—"}</TableCell>
                  <TableCell>{category._count.products}</TableCell>
                  <TableCell>{category._count.children}</TableCell>
                  <TableCell>
                    <Badge variant={category.isActive ? "default" : "secondary"}>
                      {category.isActive ? "Active" : "Inactive"}
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
                            setEditingCategory(category);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(category.id)}
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

      <CategoryFormDialog
        key={editingCategory?.id ?? "new-category"}
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editingCategory}
        parentOptions={parentOptions}
        onSuccess={refreshCategories}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete category"
        description="This category will be removed. It cannot be deleted if it has products or subcategories."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

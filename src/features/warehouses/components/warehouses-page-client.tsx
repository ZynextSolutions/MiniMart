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
import { WarehouseFormDialog } from "./warehouse-form-dialog";
import {
  deleteWarehouseAction,
  listWarehousesAction,
} from "@/features/warehouses/actions/warehouse.actions";

interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  branch: { id: string; name: string; code: string };
  _count: { stockLevels: number };
}

interface WarehousesPageClientProps {
  initialWarehouses: WarehouseRow[];
  branches: { id: string; name: string; code: string }[];
}

export function WarehousesPageClient({
  initialWarehouses,
  branches,
}: WarehousesPageClientProps) {
  const [warehouses, setWarehouses] = useState(initialWarehouses);
  const [formOpen, setFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function refreshWarehouses() {
    const result = await listWarehousesAction();
    setWarehouses(result as WarehouseRow[]);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteWarehouseAction(deleteId);
    if (result.success) {
      toast.success("Warehouse deleted");
      await refreshWarehouses();
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
          <p className="text-muted-foreground">{warehouses.length} warehouses total</p>
        </div>
        <Button onClick={() => { setEditingWarehouse(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Warehouse
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Stock Items</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No warehouses found.
                </TableCell>
              </TableRow>
            ) : (
              warehouses.map((warehouse) => (
                <TableRow key={warehouse.id}>
                  <TableCell className="font-mono text-sm">{warehouse.code}</TableCell>
                  <TableCell className="font-medium">{warehouse.name}</TableCell>
                  <TableCell>
                    {warehouse.branch.name} ({warehouse.branch.code})
                  </TableCell>
                  <TableCell>{warehouse._count.stockLevels}</TableCell>
                  <TableCell>
                    {warehouse.isDefault ? (
                      <Badge variant="default">Default</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={warehouse.isActive ? "default" : "secondary"}>
                      {warehouse.isActive ? "Active" : "Inactive"}
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
                            setEditingWarehouse(warehouse);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(warehouse.id)}
                          disabled={warehouse.isDefault}
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

      <WarehouseFormDialog
        key={editingWarehouse?.id ?? "new-warehouse"}
        open={formOpen}
        onOpenChange={setFormOpen}
        warehouse={editingWarehouse}
        branches={branches}
        onSuccess={refreshWarehouses}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete warehouse"
        description="This warehouse will be removed. It cannot be deleted if it has stock or is the default."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

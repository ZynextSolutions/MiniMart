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
import { UnitFormDialog } from "./unit-form-dialog";
import {
  deleteUnitAction,
  listUnitsAction,
} from "@/features/units/actions/unit.actions";

interface UnitRow {
  id: string;
  name: string;
  abbreviation: string;
  isActive: boolean;
}

interface UnitsPageClientProps {
  initialUnits: UnitRow[];
}

export function UnitsPageClient({ initialUnits }: UnitsPageClientProps) {
  const [units, setUnits] = useState(initialUnits);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function refreshUnits() {
    const result = await listUnitsAction();
    setUnits(result);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteUnitAction(deleteId);
    if (result.success) {
      toast.success("Unit deleted");
      await refreshUnits();
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Units</h1>
          <p className="text-muted-foreground">{units.length} units total</p>
        </div>
        <Button onClick={() => { setEditingUnit(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Unit
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Abbreviation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No units found.
                </TableCell>
              </TableRow>
            ) : (
              units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell className="font-mono">{unit.abbreviation}</TableCell>
                  <TableCell>
                    <Badge variant={unit.isActive ? "default" : "secondary"}>
                      {unit.isActive ? "Active" : "Inactive"}
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
                            setEditingUnit(unit);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(unit.id)}
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

      <UnitFormDialog
        key={editingUnit?.id ?? "new-unit"}
        open={formOpen}
        onOpenChange={setFormOpen}
        unit={editingUnit}
        onSuccess={refreshUnits}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete unit"
        description="This unit will be removed. It cannot be deleted if used by products."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

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
import { BranchFormDialog } from "./branch-form-dialog";
import {
  deleteBranchAction,
  listBranchesAction,
} from "@/features/branches/actions/branch.actions";

interface BranchRow {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isDefault: boolean;
  isActive: boolean;
  _count: { warehouses: number; cashRegisters: number };
}

interface BranchesPageClientProps {
  initialBranches: BranchRow[];
}

export function BranchesPageClient({ initialBranches }: BranchesPageClientProps) {
  const [branches, setBranches] = useState(initialBranches);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function refreshBranches() {
    const result = await listBranchesAction();
    setBranches(result as BranchRow[]);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteBranchAction(deleteId);
    if (result.success) {
      toast.success("Branch deleted");
      await refreshBranches();
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branches</h1>
          <p className="text-muted-foreground">{branches.length} branches total</p>
        </div>
        <Button onClick={() => { setEditingBranch(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Branch
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Warehouses</TableHead>
              <TableHead>Registers</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No branches found.
                </TableCell>
              </TableRow>
            ) : (
              branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-mono text-sm">{branch.code}</TableCell>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>{branch.phone ?? "—"}</TableCell>
                  <TableCell>{branch._count.warehouses}</TableCell>
                  <TableCell>{branch._count.cashRegisters}</TableCell>
                  <TableCell>
                    {branch.isDefault ? (
                      <Badge variant="default">Default</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={branch.isActive ? "default" : "secondary"}>
                      {branch.isActive ? "Active" : "Inactive"}
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
                            setEditingBranch(branch);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(branch.id)}
                          disabled={branch.isDefault}
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

      <BranchFormDialog
        key={editingBranch?.id ?? "new-branch"}
        open={formOpen}
        onOpenChange={setFormOpen}
        branch={editingBranch}
        onSuccess={refreshBranches}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete branch"
        description="This branch will be removed. The default branch cannot be deleted."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { AccountFormDialog } from "./account-form-dialog";
import {
  deleteAccountAction,
  listAccountsAction,
} from "@/features/accounting/actions/accounting.actions";
import type { AccountTreeNode } from "@/features/accounting/services/accounting-query.service";

interface CoaPageClientProps {
  tree: AccountTreeNode[];
  parentOptions: { id: string; code: string; name: string }[];
}

function AccountTreeRow({
  node,
  depth,
  onEdit,
  onDelete,
}: {
  node: AccountTreeNode;
  depth: number;
  onEdit: (node: AccountTreeNode) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <tr className="border-b">
        <td className="py-2 pl-2">
          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
            {hasChildren ? (
              <button type="button" onClick={() => setExpanded(!expanded)} className="p-0.5">
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span className="font-mono text-sm text-muted-foreground">{node.code}</span>
          </div>
        </td>
        <td className="py-2 font-medium">{node.name}</td>
        <td className="py-2">
          <Badge variant="outline">{node.type}</Badge>
        </td>
        <td className="py-2 text-sm text-muted-foreground">{node.subtype}</td>
        <td className="py-2">
          <Badge variant={node.isActive ? "default" : "secondary"}>
            {node.isActive ? "Active" : "Inactive"}
          </Badge>
        </td>
        <td className="py-2">
          {!node.isSystem && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(node)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(node.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </td>
      </tr>
      {expanded &&
        node.children.map((child) => (
          <AccountTreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

export function CoaPageClient({ tree, parentOptions }: CoaPageClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountTreeNode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentTree, setCurrentTree] = useState(tree);

  async function refresh() {
    const result = await listAccountsAction();
    setCurrentTree(result.tree);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteAccountAction(deleteId);
    if (result.success) {
      toast.success("Account deleted");
      await refresh();
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="py-2 pl-2 text-left font-medium">Code</th>
              <th className="py-2 text-left font-medium">Name</th>
              <th className="py-2 text-left font-medium">Type</th>
              <th className="py-2 text-left font-medium">Subtype</th>
              <th className="py-2 text-left font-medium">Status</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {currentTree.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  No accounts found.
                </td>
              </tr>
            ) : (
              currentTree.map((node) => (
                <AccountTreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  onEdit={(n) => {
                    setEditing(n);
                    setFormOpen(true);
                  }}
                  onDelete={setDeleteId}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <AccountFormDialog
        key={editing?.id ?? "new-account"}
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editing}
        parentOptions={parentOptions}
        onSuccess={refresh}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete account"
        description="This account will be removed. Accounts with journal entries cannot be deleted."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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
import { UserFormDialog } from "./user-form-dialog";
import {
  deleteUserAction,
  listUsersAction,
  transferOwnershipAction,
} from "@/features/users/actions/user.actions";

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  userBranchRoles: {
    branch: { id: string; name: string; code: string };
    role: { id: string; name: string };
  }[];
}

interface UsersPageClientProps {
  initialUsers: UserRow[];
  total: number;
  page: number;
  totalPages: number;
  ownerUserId: string | null;
  currentUserId: string;
  roles: { id: string; name: string }[];
  branches: { id: string; name: string; code: string }[];
}

export function UsersPageClient({
  initialUsers,
  total,
  ownerUserId,
  currentUserId,
  roles,
  branches,
}: UsersPageClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [currentOwnerUserId, setCurrentOwnerUserId] = useState(ownerUserId);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const isCurrentUserOwner = currentOwnerUserId === currentUserId;

  async function refreshUsers() {
    const result = await listUsersAction();
    setUsers(result.users as UserRow[]);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteUserAction(deleteId);
    if (result.success) {
      toast.success("User deleted");
      await refreshUsers();
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  }

  async function handleTransferOwnership() {
    if (!transferTargetId) return;
    const result = await transferOwnershipAction(transferTargetId);
    if (result.success) {
      toast.success("Ownership transferred");
      setCurrentOwnerUserId(transferTargetId);
      await refreshUsers();
    } else {
      toast.error(result.error);
    }
    setTransferTargetId(null);
  }

  const transferTarget = transferTargetId
    ? users.find((user) => user.id === transferTargetId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">{total} users total</p>
        </div>
        <Button onClick={() => { setEditingUser(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const assignment = user.userBranchRoles[0];
                const isOwner = currentOwnerUserId === user.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {isOwner ? "Owner" : (assignment?.role.name ?? "—")}
                    </TableCell>
                    <TableCell>
                      {isOwner ? "All branches" : (assignment?.branch.name ?? "—")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.lastLoginAt
                        ? format(new Date(user.lastLoginAt), "dd MMM yyyy HH:mm")
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isCurrentUserOwner && !isOwner && (
                            <DropdownMenuItem onClick={() => setTransferTargetId(user.id)}>
                              Transfer Ownership
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            disabled={isOwner}
                            onClick={() => {
                              setEditingUser(user);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isOwner}
                            className="text-destructive"
                            onClick={() => setDeleteId(user.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        roles={roles}
        branches={branches}
        onSuccess={refreshUsers}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete user"
        description="This will deactivate the user account. They will no longer be able to sign in."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!transferTargetId}
        onOpenChange={(open) => !open && setTransferTargetId(null)}
        title="Transfer ownership"
        description={
          transferTarget
            ? `Transfer organization ownership to ${transferTarget.firstName} ${transferTarget.lastName}? You will become a Manager on the default branch.`
            : "Transfer organization ownership to this user?"
        }
        confirmLabel="Transfer"
        onConfirm={handleTransferOwnership}
      />
    </div>
  );
}

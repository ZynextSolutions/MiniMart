"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Shield, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { RoleFormDialog } from "./role-form-dialog";
import {
  deleteRoleAction,
  listRolesAction,
  syncSystemRolesAction,
} from "@/features/roles/actions/role.actions";

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rolePermissions: { permission: { id: string; code: string; module: string } }[];
  _count: { userBranchRoles: number };
}

interface Permission {
  id: string;
  code: string;
  module: string;
  description: string | null;
}

interface RolesPageClientProps {
  initialRoles: Role[];
  permissions: Permission[];
}

export function RolesPageClient({
  initialRoles,
  permissions,
}: RolesPageClientProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteRoleAction(deleteId);
    if (result.success) {
      toast.success("Role deleted");
      setRoles((prev) => prev.filter((r) => r.id !== deleteId));
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  }

  function handleSyncSystemRoles() {
    startTransition(async () => {
      const result = await syncSystemRolesAction();
      if (!result.success) {
        toast.error(result.error);
        setSyncOpen(false);
        return;
      }
      const refreshed = await listRolesAction();
      setRoles(refreshed as Role[]);
      toast.success("System roles reset to defaults");
      setSyncOpen(false);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles</h1>
          <p className="text-muted-foreground">
            Manage roles and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setSyncOpen(true)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset system roles
          </Button>
          <Button
            onClick={() => {
              setEditingRole(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Role
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  {role.name}
                  {role.isSystem && (
                    <Badge variant="secondary" className="text-xs">
                      System
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{role.description}</CardDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditingRole(role);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {!role.isSystem && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteId(role.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{role.rolePermissions.length} permissions</span>
                <span>{role._count.userBranchRoles} users</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <RoleFormDialog
        key={editingRole?.id ?? "new-role"}
        open={formOpen}
        onOpenChange={setFormOpen}
        role={editingRole}
        permissions={permissions}
        onSuccess={(updatedRole) => {
          if (editingRole) {
            setRoles((prev) =>
              prev.map((r) =>
                r.id === updatedRole.id
                  ? { ...updatedRole, _count: r._count }
                  : r,
              ),
            );
          } else {
            setRoles((prev) => [...prev, updatedRole]);
          }
        }}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete role"
        description="This action cannot be undone. Users assigned to this role will lose access."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        title="Reset system roles"
        description="This overwrites all system role permissions and descriptions with the current application defaults. Custom roles are not changed."
        confirmLabel="Reset"
        variant="destructive"
        onConfirm={handleSyncSystemRoles}
      />
    </div>
  );
}

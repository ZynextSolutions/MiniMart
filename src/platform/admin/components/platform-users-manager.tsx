"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deletePlatformUserAction,
  upsertPlatformUserAction,
} from "@/platform/admin/platform.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PlatformUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const emptyForm = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  role: "SUPPORT" as const,
  isActive: true,
};

export function PlatformUsersManager({ users }: { users: PlatformUser[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PlatformUser | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [role, setRole] = useState<"SUPER_ADMIN" | "SUPPORT" | "BILLING">("SUPPORT");

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const result = await upsertPlatformUserAction({
      id: editing === "new" ? undefined : editing.id,
      email: String(form.get("email")),
      password: String(form.get("password") || "") || undefined,
      firstName: String(form.get("firstName")),
      lastName: String(form.get("lastName")),
      role: role,
      isActive: editing === "new" ? true : form.get("isActive") === "on",
    });
    setSaving(false);
    if (result.success) {
      toast.success(editing === "new" ? "User created" : "User updated");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDeactivate(id: string) {
    setDeletingId(id);
    const result = await deletePlatformUserAction(id);
    setDeletingId(null);
    if (result.success) {
      toast.success("User deactivated");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing("new"); setRole("SUPPORT"); }}>Add user</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.firstName} {user.lastName}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                <TableCell>{user.isActive ? "Active" : "Inactive"}</TableCell>
                <TableCell>
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                </TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(user); setRole(user.role as "SUPER_ADMIN" | "SUPPORT" | "BILLING"); }}>
                    Edit
                  </Button>
                  {user.isActive && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deletingId === user.id}
                      onClick={() => handleDeactivate(user.id)}
                    >
                      Deactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="rounded-md border p-4 space-y-4 max-w-xl">
          <h3 className="font-semibold">
            {editing === "new" ? "New platform user" : `Edit ${editing.firstName}`}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={editing === "new" ? emptyForm.firstName : editing.firstName}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={editing === "new" ? emptyForm.lastName : editing.lastName}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={editing === "new" ? emptyForm.email : editing.email}
                disabled={editing !== "new"}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="password">
                Password {editing !== "new" && "(leave blank to keep current)"}
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required={editing === "new"}
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "SUPER_ADMIN" | "SUPPORT" | "BILLING")}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="SUPPORT">Support</SelectItem>
                  <SelectItem value="BILLING">Billing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {editing !== "new" && (
            <div className="flex items-center gap-2">
              <Switch id="isActive" name="isActive" defaultChecked={editing.isActive} />
              <Label htmlFor="isActive">Active</Label>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

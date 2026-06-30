"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  createRoleAction,
  updateRoleAction,
} from "@/features/roles/actions/role.actions";

const formSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).min(1, "Select at least one permission"),
});

type FormValues = z.infer<typeof formSchema>;

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    rolePermissions: { permission: { id: string } }[];
  } | null;
  permissions: { id: string; code: string; module: string; description: string | null }[];
  onSuccess: (role: {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    rolePermissions: { permission: { id: string; code: string; module: string } }[];
    _count: { userBranchRoles: number };
  }) => void;
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  permissions,
  onSuccess,
}: RoleFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!role;

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, typeof permissions> = {};
    for (const p of permissions) {
      if (!groups[p.module]) groups[p.module] = [];
      groups[p.module].push(p);
    }
    return groups;
  }, [permissions]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      permissionIds: role?.rolePermissions.map((rp) => rp.permission.id) ?? [],
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const result = isEdit
        ? await updateRoleAction({ id: role!.id, ...values })
        : await createRoleAction(values);

      if (result.success && result.role) {
        toast.success(isEdit ? "Role updated" : "Role created");
        onOpenChange(false);
        form.reset();
        onSuccess({
          ...result.role,
          _count: { userBranchRoles: 0 },
        });
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  function togglePermission(permissionId: string, checked: boolean) {
    const current = form.getValues("permissionIds");
    form.setValue(
      "permissionIds",
      checked
        ? [...current, permissionId]
        : current.filter((id) => id !== permissionId),
    );
  }

  function toggleModule(modulePerms: typeof permissions, checked: boolean) {
    const current = form.getValues("permissionIds");
    const moduleIds = modulePerms.map((p) => p.id);
    form.setValue(
      "permissionIds",
      checked
        ? [...new Set([...current, ...moduleIds])]
        : current.filter((id) => !moduleIds.includes(id)),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Role" : "Create Role"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input disabled={role?.isSystem} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="permissionIds"
              render={() => (
                <FormItem>
                  <FormLabel>Permissions</FormLabel>
                  <ScrollArea className="h-64 rounded-md border p-3">
                    <div className="space-y-4">
                      {Object.entries(groupedPermissions).map(([module, perms]) => (
                        <div key={module}>
                          <div className="mb-2 flex items-center gap-2">
                            <Checkbox
                              onCheckedChange={(checked) =>
                                toggleModule(perms, !!checked)
                              }
                            />
                            <span className="text-sm font-semibold capitalize">
                              {module}
                            </span>
                          </div>
                          <div className="ml-6 space-y-2">
                            {perms.map((perm) => (
                              <div key={perm.id} className="flex items-center gap-2">
                                <Checkbox
                                  checked={form
                                    .watch("permissionIds")
                                    .includes(perm.id)}
                                  onCheckedChange={(checked) =>
                                    togglePermission(perm.id, !!checked)
                                  }
                                />
                                <span className="text-sm text-muted-foreground">
                                  {perm.code}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Role"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

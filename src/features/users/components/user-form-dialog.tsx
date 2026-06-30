"use client";

import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createUserAction,
  updateUserAction,
} from "@/features/users/actions/user.actions";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  phone: z.string().optional(),
  branchId: z.string().uuid("Select a branch"),
  roleId: z.string().uuid("Select a role"),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    isActive: boolean;
    userBranchRoles: {
      branch: { id: string };
      role: { id: string };
    }[];
  } | null;
  roles: { id: string; name: string }[];
  branches: { id: string; name: string; code: string }[];
  onSuccess: () => void;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  roles,
  branches,
  onSuccess,
}: UserFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!user;
  const assignment = user?.userBranchRoles[0];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: user?.email ?? "",
      password: "",
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
      branchId: assignment?.branch.id ?? "",
      roleId: assignment?.role.id ?? "",
      isActive: user?.isActive ?? true,
    },
  });

  useEffect(() => {
    const nextAssignment = user?.userBranchRoles[0];
    form.reset({
      email: user?.email ?? "",
      password: "",
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
      branchId: nextAssignment?.branch.id ?? "",
      roleId: nextAssignment?.role.id ?? "",
      isActive: user?.isActive ?? true,
    });
  }, [form, user, open]);

  async function onSubmit(values: FormValues) {
    if (!isEdit && (!values.password || values.password.length < 8)) {
      form.setError("password", { message: "Password must be at least 8 characters" });
      return;
    }

    setLoading(true);
    try {
      const result = isEdit
        ? await updateUserAction({
            id: user!.id,
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone,
            isActive: values.isActive,
            password: values.password || undefined,
            branchId: values.branchId,
            roleId: values.roleId,
          })
        : await createUserAction({
            email: values.email,
            password: values.password!,
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone,
            branchId: values.branchId,
            roleId: values.roleId,
          });

      if (result.success) {
        toast.success(isEdit ? "User updated" : "User created");
        onOpenChange(false);
        form.reset();
        onSuccess();
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Add User"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" disabled={isEdit} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isEdit ? "New Password (optional)" : "Password"}
                  </FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEdit && (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel>Active</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create User"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

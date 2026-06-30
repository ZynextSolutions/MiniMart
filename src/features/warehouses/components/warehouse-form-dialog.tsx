"use client";

import { useState } from "react";
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
  createWarehouseAction,
  updateWarehouseAction,
} from "@/features/warehouses/actions/warehouse.actions";

const formSchema = z.object({
  branchId: z.string().uuid("Select a branch"),
  code: z.string().min(1, "Required").max(20),
  name: z.string().min(1, "Required"),
  address: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface WarehouseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    isDefault: boolean;
    isActive: boolean;
    branch: { id: string };
  } | null;
  branches: { id: string; name: string; code: string }[];
  onSuccess: () => void;
}

export function WarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
  branches,
  onSuccess,
}: WarehouseFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!warehouse;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      branchId: warehouse?.branch.id ?? branches[0]?.id ?? "",
      code: warehouse?.code ?? "",
      name: warehouse?.name ?? "",
      address: warehouse?.address ?? "",
      isDefault: warehouse?.isDefault ?? false,
      isActive: warehouse?.isActive ?? true,
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const result = isEdit
        ? await updateWarehouseAction({
            id: warehouse!.id,
            name: values.name,
            address: values.address,
            isDefault: values.isDefault,
            isActive: values.isActive,
          })
        : await createWarehouseAction({
            branchId: values.branchId,
            code: values.code,
            name: values.name,
            address: values.address,
            isDefault: values.isDefault,
          });

      if (result.success) {
        toast.success(isEdit ? "Warehouse updated" : "Warehouse created");
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
          <DialogTitle>{isEdit ? "Edit Warehouse" : "Add Warehouse"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!isEdit && (
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
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isEdit} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
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
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel>Default warehouse</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
              {isEdit ? "Save Changes" : "Create Warehouse"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

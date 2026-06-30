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
  createCustomerAction,
  updateCustomerAction,
} from "@/features/customers/actions/customer.actions";

const formSchema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  membershipTier: z.string().optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    membershipTier: string | null;
    creditLimit: string;
    isActive: boolean;
  } | null;
  onSuccess: () => void;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: CustomerFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!customer;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: customer?.name ?? "",
      email: customer?.email ?? "",
      phone: customer?.phone ?? "",
      address: customer?.address ?? "",
      membershipTier: customer?.membershipTier ?? "",
      creditLimit: customer ? parseFloat(customer.creditLimit) : 0,
      isActive: customer?.isActive ?? true,
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const result = isEdit
        ? await updateCustomerAction({
            id: customer!.id,
            name: values.name,
            email: values.email,
            phone: values.phone,
            address: values.address,
            membershipTier: values.membershipTier,
            creditLimit: values.creditLimit,
            isActive: values.isActive,
          })
        : await createCustomerAction({
            name: values.name,
            email: values.email,
            phone: values.phone,
            address: values.address,
            membershipTier: values.membershipTier,
            creditLimit: values.creditLimit,
          });

      if (result.success) {
        toast.success(isEdit ? "Customer updated" : "Customer created");
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Customer" : "Add Customer"}</DialogTitle>
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
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
              name="membershipTier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Membership Tier</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Gold, Silver" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="creditLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit Limit</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="0.01" {...field} />
                  </FormControl>
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
              {isEdit ? "Save Changes" : "Create Customer"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

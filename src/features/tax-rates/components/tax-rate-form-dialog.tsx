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
  createTaxRateAction,
  updateTaxRateAction,
} from "@/features/tax-rates/actions/tax-rate.actions";

const formSchema = z.object({
  name: z.string().min(1, "Required"),
  ratePercent: z.coerce
    .number()
    .min(0, "Must be at least 0")
    .max(100, "Must be at most 100"),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface TaxRateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxRate?: {
    id: string;
    name: string;
    rate: string;
    isDefault: boolean;
    isActive: boolean;
  } | null;
  onSuccess: () => void;
}

export function TaxRateFormDialog({
  open,
  onOpenChange,
  taxRate,
  onSuccess,
}: TaxRateFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!taxRate;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: taxRate?.name ?? "",
      ratePercent: taxRate
        ? parseFloat(taxRate.rate) * 100
        : 7,
      isDefault: taxRate?.isDefault ?? false,
      isActive: taxRate?.isActive ?? true,
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const rate = values.ratePercent / 100;

      const result = isEdit
        ? await updateTaxRateAction({
            id: taxRate!.id,
            name: values.name,
            rate,
            isDefault: values.isDefault,
            isActive: values.isActive,
          })
        : await createTaxRateAction({
            name: values.name,
            rate,
            isDefault: values.isDefault,
          });

      if (result.success) {
        toast.success(isEdit ? "Tax rate updated" : "Tax rate created");
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
          <DialogTitle>{isEdit ? "Edit Tax Rate" : "Add Tax Rate"}</DialogTitle>
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
                    <Input {...field} placeholder="VAT 7%" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ratePercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate (%)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min={0} max={100} {...field} />
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
                  <FormLabel>Default tax rate</FormLabel>
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
              {isEdit ? "Save Changes" : "Create Tax Rate"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

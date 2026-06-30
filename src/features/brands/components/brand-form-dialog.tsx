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
  createBrandAction,
  updateBrandAction,
} from "@/features/brands/actions/brand.actions";

const formSchema = z.object({
  name: z.string().min(1, "Required"),
  logoUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface BrandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand?: {
    id: string;
    name: string;
    logoUrl: string | null;
    isActive: boolean;
  } | null;
  onSuccess: () => void;
}

export function BrandFormDialog({
  open,
  onOpenChange,
  brand,
  onSuccess,
}: BrandFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!brand;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: brand?.name ?? "",
      logoUrl: brand?.logoUrl ?? "",
      isActive: brand?.isActive ?? true,
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const result = isEdit
        ? await updateBrandAction({
            id: brand!.id,
            name: values.name,
            logoUrl: values.logoUrl,
            isActive: values.isActive,
          })
        : await createBrandAction({
            name: values.name,
            logoUrl: values.logoUrl,
          });

      if (result.success) {
        toast.success(isEdit ? "Brand updated" : "Brand created");
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
          <DialogTitle>{isEdit ? "Edit Brand" : "Add Brand"}</DialogTitle>
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
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL (optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://" {...field} />
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
              {isEdit ? "Save Changes" : "Create Brand"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

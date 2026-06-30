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
  createUnitAction,
  updateUnitAction,
} from "@/features/units/actions/unit.actions";

const formSchema = z.object({
  name: z.string().min(1, "Required"),
  abbreviation: z.string().min(1, "Required").max(10),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface UnitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: {
    id: string;
    name: string;
    abbreviation: string;
    isActive: boolean;
  } | null;
  onSuccess: () => void;
}

export function UnitFormDialog({
  open,
  onOpenChange,
  unit,
  onSuccess,
}: UnitFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!unit;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: unit?.name ?? "",
      abbreviation: unit?.abbreviation ?? "",
      isActive: unit?.isActive ?? true,
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const result = isEdit
        ? await updateUnitAction({
            id: unit!.id,
            name: values.name,
            abbreviation: values.abbreviation,
            isActive: values.isActive,
          })
        : await createUnitAction({
            name: values.name,
            abbreviation: values.abbreviation,
          });

      if (result.success) {
        toast.success(isEdit ? "Unit updated" : "Unit created");
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
          <DialogTitle>{isEdit ? "Edit Unit" : "Add Unit"}</DialogTitle>
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
              name="abbreviation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abbreviation</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={10} />
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
              {isEdit ? "Save Changes" : "Create Unit"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

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
  createCategoryAction,
  updateCategoryAction,
} from "@/features/categories/actions/category.actions";

const NONE_PARENT = "__none__";

const formSchema = z.object({
  name: z.string().min(1, "Required"),
  parentId: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: {
    id: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
    parent: { id: string; name: string } | null;
  } | null;
  parentOptions: { id: string; name: string; parentId: string | null }[];
  onSuccess: () => void;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  parentOptions,
  onSuccess,
}: CategoryFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!category;

  const availableParents = parentOptions.filter(
    (p) => p.id !== category?.id,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name ?? "",
      parentId: category?.parent?.id ?? NONE_PARENT,
      description: category?.description ?? "",
      sortOrder: category?.sortOrder ?? 0,
      isActive: category?.isActive ?? true,
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const parentId =
        values.parentId && values.parentId !== NONE_PARENT
          ? values.parentId
          : null;

      const result = isEdit
        ? await updateCategoryAction({
            id: category!.id,
            name: values.name,
            parentId,
            description: values.description,
            sortOrder: values.sortOrder,
            isActive: values.isActive,
          })
        : await createCategoryAction({
            name: values.name,
            parentId,
            description: values.description,
            sortOrder: values.sortOrder,
          });

      if (result.success) {
        toast.success(isEdit ? "Category updated" : "Category created");
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
          <DialogTitle>{isEdit ? "Edit Category" : "Add Category"}</DialogTitle>
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
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None (top level)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_PARENT}>None (top level)</SelectItem>
                      {availableParents.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
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
              name="sortOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort Order</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
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
              {isEdit ? "Save Changes" : "Create Category"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

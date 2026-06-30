"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ScanLine, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createProductAction,
  updateProductAction,
  generateBarcodeAction,
} from "@/features/products/actions/product.actions";
import { BarcodeScannerModal } from "@/features/pos/components/barcode-scanner-modal";

const schema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  unitId: z.string().uuid("Select a unit"),
  supplierId: z.string().optional(),
  taxRateId: z.string().optional(),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  wholesalePrice: z.coerce.number().min(0).optional(),
  minStock: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional(),
  trackBatch: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
  barcode: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ProductFormProps {
  product?: {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    categoryId: string | null;
    brandId: string | null;
    unitId: string;
    supplierId: string | null;
    taxRateId: string | null;
    costPrice: { toString(): string };
    sellingPrice: { toString(): string };
    wholesalePrice: { toString(): string } | null;
    minStock: { toString(): string };
    reorderLevel: { toString(): string };
    trackBatch: boolean;
    trackExpiry: boolean;
    isActive: boolean;
    barcodes: { code: string }[];
    images: { url: string }[];
  };
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  units: { id: string; name: string; abbreviation: string }[];
  suppliers: { id: string; name: string; code: string }[];
  taxRates: { id: string; name: string; rate: { toString(): string } }[];
}

export function ProductForm({
  product,
  categories,
  brands,
  units,
  suppliers,
  taxRates,
}: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const isEdit = !!product;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: product?.sku ?? "",
      name: product?.name ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? undefined,
      brandId: product?.brandId ?? undefined,
      unitId: product?.unitId ?? "",
      supplierId: product?.supplierId ?? undefined,
      taxRateId: product?.taxRateId ?? undefined,
      costPrice: product ? parseFloat(product.costPrice.toString()) : 0,
      sellingPrice: product ? parseFloat(product.sellingPrice.toString()) : 0,
      wholesalePrice: product?.wholesalePrice
        ? parseFloat(product.wholesalePrice.toString())
        : undefined,
      minStock: product ? parseFloat(product.minStock.toString()) : 0,
      reorderLevel: product ? parseFloat(product.reorderLevel.toString()) : 0,
      trackBatch: product?.trackBatch ?? false,
      trackExpiry: product?.trackExpiry ?? false,
      barcode: product?.barcodes[0]?.code ?? "",
      imageUrl: product?.images[0]?.url ?? "",
      isActive: product?.isActive ?? true,
    },
  });

  async function handleGenerateBarcode() {
    const result = await generateBarcodeAction("INTERNAL");
    form.setValue("barcode", result.code);
  }

  function handleBarcodeScanned(code: string) {
    form.setValue("barcode", code, { shouldDirty: true, shouldValidate: true });
    if (!form.getValues("sku")) {
      form.setValue("sku", code, { shouldDirty: true, shouldValidate: true });
    }
    toast.success("Barcode scanned");
  }

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const payload = {
        ...values,
        categoryId: values.categoryId || null,
        brandId: values.brandId || null,
        supplierId: values.supplierId || null,
        taxRateId: values.taxRateId || null,
        imageUrl: values.imageUrl || undefined,
      };

      const result = isEdit
        ? await updateProductAction({ id: product!.id, ...payload })
        : await createProductAction(payload);

      if (result.success) {
        toast.success(isEdit ? "Product updated" : "Product created");
        router.push("/products");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Product Name</FormLabel>
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value === "__none__" ? undefined : value)
                        }
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
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
                  name="brandId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value === "__none__" ? undefined : value)
                        }
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {brands.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="unitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.abbreviation})
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
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value === "__none__" ? undefined : value)
                        }
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} ({s.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing & Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sellingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="wholesalePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wholesale</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="taxRateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "__none__" ? undefined : value)
                      }
                      value={field.value ?? "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tax rate" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {taxRates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({(parseFloat(t.rate.toString()) * 100).toFixed(0)}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Stock</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reorderLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Level</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input {...field} placeholder="Auto-generated if empty" />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setScannerOpen(true)}
                        title="Scan barcode with camera"
                      >
                        <ScanLine className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" onClick={handleGenerateBarcode}>
                        <Wand2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormDescription>
                      Scan with camera, type manually, or auto-generate on save
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://..." />
                    </FormControl>
                    <FormDescription>Cloudinary upload in Phase 8</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-6">
                <FormField
                  control={form.control}
                  name="trackBatch"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Track Batch</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trackExpiry"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Track Expiry</FormLabel>
                    </FormItem>
                  )}
                />
                {isEdit && (
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0">Active</FormLabel>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Product"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
      <BarcodeScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleBarcodeScanned}
      />
    </Form>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ProductService } from "@/features/products/services/product.service";
import { ProductImportService } from "@/features/products/services/product-import.service";
import type { ProductImportResult } from "@/features/products/lib/product-import";
import { BarcodeService } from "@/lib/services/barcode-service";
import { getErrorMessage } from "@/lib/errors/app-error";

const createSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid(),
  supplierId: z.string().uuid().optional().nullable(),
  taxRateId: z.string().uuid().optional().nullable(),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  wholesalePrice: z.coerce.number().min(0).optional(),
  minStock: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional(),
  trackBatch: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
  barcode: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export async function listProductsAction(params?: {
  search?: string;
  page?: number;
  categoryId?: string;
  brandId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.PRODUCTS.VIEW);
  return ProductService.list({
    organizationId: session.user.organizationId,
    ...params,
  });
}

export async function getProductAction(id: string) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.PRODUCTS.VIEW);
  return ProductService.getById(id, session.user.organizationId);
}

export async function createProductAction(input: z.infer<typeof createSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.PRODUCTS.CREATE);
    const data = createSchema.parse(input);
    const product = await ProductService.create(
      {
        organizationId: session.user.organizationId,
        ...data,
        categoryId: data.categoryId ?? undefined,
        brandId: data.brandId ?? undefined,
        supplierId: data.supplierId ?? undefined,
        taxRateId: data.taxRateId ?? undefined,
        barcode: data.barcode?.trim() || undefined,
        imageUrl: data.imageUrl || undefined,
      },
      session.user.id,
    );
    revalidatePath("/products");
    return { success: true, productId: product.id };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function importProductsAction(
  formData: FormData,
): Promise<{ success: true; result: ProductImportResult } | { success: false; error: string }> {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.PRODUCTS.CREATE);

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, error: "Please select a CSV or Excel file" };
    }

    if (file.size === 0) {
      return { success: false, error: "The selected file is empty" };
    }

    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "File is too large (max 5 MB)" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsedRows = await ProductImportService.parseFile(file.name, buffer);
    const result = await ProductImportService.importRows(
      session.user.organizationId,
      session.user.id,
      parsedRows,
    );

    revalidatePath("/products");
    return { success: true, result };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateProductAction(input: z.infer<typeof updateSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.PRODUCTS.UPDATE);
    const { id, ...data } = updateSchema.parse(input);
    const product = await ProductService.update(
      id,
      session.user.organizationId,
      {
        ...data,
        categoryId: data.categoryId,
        brandId: data.brandId,
        supplierId: data.supplierId,
        taxRateId: data.taxRateId,
        barcode: data.barcode?.trim() || undefined,
        imageUrl: data.imageUrl || undefined,
      },
      session.user.id,
    );
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return { success: true, productId: product.id };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteProductAction(id: string) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.PRODUCTS.DELETE);
    await ProductService.softDelete(id, session.user.organizationId, session.user.id);
    revalidatePath("/products");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function generateBarcodeAction(type: "INTERNAL" | "EAN13" = "INTERNAL") {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.BARCODE.GENERATE);
  const code =
    type === "EAN13"
      ? await BarcodeService.generateEAN13()
      : await BarcodeService.generateInternalCode(session.user.organizationId);
  return { code };
}

export async function addProductBarcodeAction(input: {
  productId: string;
  code?: string;
  type?: "INTERNAL" | "EAN13" | "CODE128";
  variantId?: string;
}) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.BARCODE.GENERATE);
    const barcode = await ProductService.addBarcode(
      input.productId,
      session.user.organizationId,
      {
        code: input.code,
        type: input.type ? BarcodeService.mapBarcodeType(input.type) : undefined,
        variantId: input.variantId,
        isPrimary: true,
      },
      session.user.id,
    );
    revalidatePath(`/products/${input.productId}`);
    return { success: true, barcode };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

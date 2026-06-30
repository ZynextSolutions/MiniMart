"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { getErrorMessage } from "@/lib/errors/app-error";

const schema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  paymentTerms: z.coerce.number().int().min(0).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
});

const updateSchema = schema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export async function listSuppliersAction(params?: { search?: string; page?: number }) {
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.SUPPLIERS.VIEW);
  return SupplierService.list(session.user.organizationId, params);
}

export async function createSupplierAction(input: z.infer<typeof schema>) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.SUPPLIERS.MANAGE);
    const data = schema.parse(input);
    const supplier = await SupplierService.create(
      {
        organizationId: session.user.organizationId,
        ...data,
        email: data.email || undefined,
      },
      session.user.id,
    );
    revalidatePath("/suppliers");
    return { success: true, supplier };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateSupplierAction(input: z.infer<typeof updateSchema>) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.SUPPLIERS.MANAGE);
    const { id, ...data } = updateSchema.parse(input);
    const supplier = await SupplierService.update(
      id,
      session.user.organizationId,
      { ...data, email: data.email || undefined },
      session.user.id,
    );
    revalidatePath("/suppliers");
    return { success: true, supplier };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteSupplierAction(id: string) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.SUPPLIERS.MANAGE);
    await SupplierService.softDelete(id, session.user.organizationId, session.user.id);
    revalidatePath("/suppliers");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

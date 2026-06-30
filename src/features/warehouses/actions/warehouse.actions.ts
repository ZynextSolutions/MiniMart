"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { getErrorMessage } from "@/lib/errors/app-error";

const schema = z.object({
  branchId: z.string().uuid(),
  code: z.string().min(1).max(20),
  name: z.string().min(1),
  address: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const updateSchema = schema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export async function listWarehousesAction(branchId?: string) {
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.SETTINGS.WAREHOUSE_MANAGE);
  return WarehouseService.list(session.user.organizationId, branchId);
}

export async function createWarehouseAction(input: z.infer<typeof schema>) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.SETTINGS.WAREHOUSE_MANAGE);
    const data = schema.parse(input);
    const warehouse = await WarehouseService.create(
      { ...data, organizationId: session.user.organizationId },
      session.user.id,
    );
    revalidatePath("/settings/warehouses");
    return { success: true, warehouse };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateWarehouseAction(input: z.infer<typeof updateSchema>) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.SETTINGS.WAREHOUSE_MANAGE);
    const { id, ...data } = updateSchema.parse(input);
    const warehouse = await WarehouseService.update(
      id,
      session.user.organizationId,
      data,
      session.user.id,
    );
    revalidatePath("/settings/warehouses");
    return { success: true, warehouse };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteWarehouseAction(id: string) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.SETTINGS.WAREHOUSE_MANAGE);
    await WarehouseService.softDelete(id, session.user.organizationId, session.user.id);
    revalidatePath("/settings/warehouses");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

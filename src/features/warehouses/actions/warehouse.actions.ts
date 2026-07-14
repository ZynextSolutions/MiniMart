"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import {
  requireAuthorizedBranchId,
  resolveSessionBranchFilter,
} from "@/lib/auth/branch-access";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { getErrorMessage } from "@/lib/errors/app-error";
import { prisma } from "@/infrastructure/database/prisma";

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

async function authorizeWarehouseBranch(
  session: Awaited<ReturnType<typeof requireSession>>,
  branchId: string,
) {
  const authorizedBranchId = requireAuthorizedBranchId(
    session.user.branchIds,
    branchId,
  );
  await authorize(session.user.id, PERMISSIONS.SETTINGS.WAREHOUSE_MANAGE, {
    branchId: authorizedBranchId,
  });
  return authorizedBranchId;
}

export async function listWarehousesAction(branchId?: string) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.SETTINGS.WAREHOUSE_MANAGE);
  const branchFilter = resolveSessionBranchFilter(session.user, branchId);
  return WarehouseService.list(session.user.organizationId, branchFilter);
}

export async function createWarehouseAction(input: z.infer<typeof schema>) {
  try {
    const session = await requireSession();
    const data = schema.parse(input);
    const authorizedBranchId = await authorizeWarehouseBranch(
      session,
      data.branchId,
    );
    const warehouse = await WarehouseService.create(
      {
        ...data,
        branchId: authorizedBranchId,
        organizationId: session.user.organizationId,
      },
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
    const { id, ...data } = updateSchema.parse(input);

    const existing = await prisma.warehouse.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      select: { branchId: true },
    });
    if (!existing) {
      return { success: false, error: "Warehouse not found" };
    }
    await authorizeWarehouseBranch(session, existing.branchId);

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
    const existing = await prisma.warehouse.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      select: { branchId: true },
    });
    if (!existing) {
      return { success: false, error: "Warehouse not found" };
    }
    await authorizeWarehouseBranch(session, existing.branchId);

    await WarehouseService.softDelete(
      id,
      session.user.organizationId,
      session.user.id,
    );
    revalidatePath("/settings/warehouses");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

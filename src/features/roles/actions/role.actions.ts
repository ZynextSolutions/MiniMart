"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { RoleService } from "@/features/roles/services/role.service";
import { getErrorMessage } from "@/lib/errors/app-error";

const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()),
});

const updateRoleSchema = createRoleSchema.partial().extend({
  id: z.string().uuid(),
});

export async function createRoleAction(input: z.infer<typeof createRoleSchema>) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.ROLES.MANAGE);

    const data = createRoleSchema.parse(input);
    const role = await RoleService.create(
      { ...data, organizationId: session.user.organizationId },
      session.user.id,
    );

    revalidatePath("/settings/roles");
    return { success: true, role };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateRoleAction(input: z.infer<typeof updateRoleSchema>) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.ROLES.MANAGE);

    const data = updateRoleSchema.parse(input);
    const { id, ...updateData } = data;
    const role = await RoleService.update(
      id,
      session.user.organizationId,
      updateData,
      session.user.id,
    );

    revalidatePath("/settings/roles");
    return { success: true, role };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteRoleAction(id: string) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.ROLES.MANAGE);

    await RoleService.softDelete(id, session.user.organizationId, session.user.id);
    revalidatePath("/settings/roles");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function listRolesAction() {
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.ROLES.VIEW);
  return RoleService.list(session.user.organizationId);
}

export async function listPermissionsAction() {
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.ROLES.VIEW);
  return RoleService.listPermissions();
}

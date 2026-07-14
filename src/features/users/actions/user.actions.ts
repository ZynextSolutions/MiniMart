"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { isOrganizationOwner } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { UserService } from "@/features/users/services/user.service";
import { getErrorMessage } from "@/lib/errors/app-error";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  branchId: z.string().uuid(),
  roleId: z.string().uuid(),
});

const updateUserSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  branchId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
});

export async function createUserAction(input: z.infer<typeof createUserSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.USERS.CREATE);

    const data = createUserSchema.parse(input);
    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await UserService.create(
      {
        organizationId: session.user.organizationId,
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        branchRoles: [{ branchId: data.branchId, roleId: data.roleId }],
      },
      session.user.id,
    );

    revalidatePath("/settings/users");
    return { success: true, user };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateUserAction(input: z.infer<typeof updateUserSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.USERS.UPDATE);

    const data = updateUserSchema.parse(input);
    const passwordHash = data.password
      ? await bcrypt.hash(data.password, 12)
      : undefined;

    const user = await UserService.update(
      data.id,
      session.user.organizationId,
      {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        isActive: data.isActive,
        passwordHash,
        branchRoles:
          data.branchId && data.roleId
            ? [{ branchId: data.branchId, roleId: data.roleId }]
            : undefined,
      },
      session.user.id,
    );

    revalidatePath("/settings/users");
    return { success: true, user };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteUserAction(id: string) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.USERS.DELETE);

    if (id === session.user.id) {
      return { success: false, error: "Cannot delete your own account" };
    }

    await UserService.softDelete(id, session.user.organizationId, session.user.id);
    revalidatePath("/settings/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function listUsersAction(params?: { page?: number; search?: string }) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.USERS.VIEW);

  return UserService.list({
    organizationId: session.user.organizationId,
    page: params?.page,
    search: params?.search,
  });
}

export async function transferOwnershipAction(targetUserId: string) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.USERS.UPDATE);

    const isOwner = await isOrganizationOwner(
      session.user.id,
      session.user.organizationId,
    );
    if (!isOwner) {
      return { success: false, error: "Only the current owner can transfer ownership" };
    }

    await UserService.transferOwnership(
      session.user.organizationId,
      session.user.id,
      targetUserId,
    );

    revalidatePath("/settings/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

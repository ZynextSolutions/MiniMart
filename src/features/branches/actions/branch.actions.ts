"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BranchService } from "@/features/branches/services/branch.service";
import { getErrorMessage } from "@/lib/errors/app-error";

const schema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
});

const updateSchema = schema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export async function listBranchesAction() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.SETTINGS.BRANCH_MANAGE);
  return BranchService.list(session.user.organizationId);
}

export async function createBranchAction(input: z.infer<typeof schema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.SETTINGS.BRANCH_MANAGE);
    const data = schema.parse(input);
    const branch = await BranchService.create(
      { ...data, organizationId: session.user.organizationId, email: data.email || undefined },
      session.user.id,
    );
    revalidatePath("/settings/branches");
    return { success: true, branch };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateBranchAction(input: z.infer<typeof updateSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.SETTINGS.BRANCH_MANAGE);
    const { id, ...data } = updateSchema.parse(input);
    const branch = await BranchService.update(
      id,
      session.user.organizationId,
      { ...data, email: data.email || undefined },
      session.user.id,
    );
    revalidatePath("/settings/branches");
    return { success: true, branch };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteBranchAction(id: string) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.SETTINGS.BRANCH_MANAGE);
    await BranchService.softDelete(id, session.user.organizationId, session.user.id);
    revalidatePath("/settings/branches");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

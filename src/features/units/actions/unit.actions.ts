"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { UnitService } from "@/features/units/services/unit.service";
import { getErrorMessage } from "@/lib/errors/app-error";

const schema = z.object({
  name: z.string().min(1),
  abbreviation: z.string().min(1).max(10),
});

const updateSchema = schema.partial().extend({ id: z.string().uuid(), isActive: z.boolean().optional() });

export async function listUnitsAction(search?: string) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.UNITS.MANAGE);
  return UnitService.list(session.user.organizationId, search);
}

export async function createUnitAction(input: z.infer<typeof schema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.UNITS.MANAGE);
    const data = schema.parse(input);
    const unit = await UnitService.create(
      { ...data, organizationId: session.user.organizationId },
      session.user.id,
    );
    revalidatePath("/units");
    return { success: true, unit };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateUnitAction(input: z.infer<typeof updateSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.UNITS.MANAGE);
    const { id, ...data } = updateSchema.parse(input);
    const unit = await UnitService.update(id, session.user.organizationId, data, session.user.id);
    revalidatePath("/units");
    return { success: true, unit };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteUnitAction(id: string) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.UNITS.MANAGE);
    await UnitService.softDelete(id, session.user.organizationId, session.user.id);
    revalidatePath("/units");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

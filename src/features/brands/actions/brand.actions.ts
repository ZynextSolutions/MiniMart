"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BrandService } from "@/features/brands/services/brand.service";
import { getErrorMessage } from "@/lib/errors/app-error";

const schema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

const updateSchema = schema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export async function listBrandsAction(search?: string) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.BRANDS.MANAGE);
  return BrandService.list(session.user.organizationId, search);
}

export async function createBrandAction(input: z.infer<typeof schema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.BRANDS.MANAGE);
    const data = schema.parse(input);
    const brand = await BrandService.create(
      {
        organizationId: session.user.organizationId,
        name: data.name,
        logoUrl: data.logoUrl || undefined,
      },
      session.user.id,
    );
    revalidatePath("/brands");
    return { success: true, brand };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateBrandAction(input: z.infer<typeof updateSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.BRANDS.MANAGE);
    const { id, ...data } = updateSchema.parse(input);
    const brand = await BrandService.update(
      id,
      session.user.organizationId,
      { ...data, logoUrl: data.logoUrl || undefined },
      session.user.id,
    );
    revalidatePath("/brands");
    return { success: true, brand };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteBrandAction(id: string) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.BRANDS.MANAGE);
    await BrandService.softDelete(id, session.user.organizationId, session.user.id);
    revalidatePath("/brands");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

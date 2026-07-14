"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CategoryService } from "@/features/categories/services/category.service";
import { getErrorMessage } from "@/lib/errors/app-error";

const schema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().optional().nullable(),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const updateSchema = schema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export async function listCategoriesAction() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.CATEGORIES.MANAGE);
  return CategoryService.list(session.user.organizationId);
}

export async function createCategoryAction(input: z.infer<typeof schema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.CATEGORIES.MANAGE);
    const data = schema.parse(input);
    const category = await CategoryService.create(
      {
        ...data,
        organizationId: session.user.organizationId,
        parentId: data.parentId ?? undefined,
      },
      session.user.id,
    );
    revalidatePath("/categories");
    return { success: true, category };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateCategoryAction(input: z.infer<typeof updateSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.CATEGORIES.MANAGE);
    const { id, ...data } = updateSchema.parse(input);
    const category = await CategoryService.update(
      id,
      session.user.organizationId,
      data,
      session.user.id,
    );
    revalidatePath("/categories");
    return { success: true, category };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteCategoryAction(id: string) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.CATEGORIES.MANAGE);
    await CategoryService.softDelete(id, session.user.organizationId, session.user.id);
    revalidatePath("/categories");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

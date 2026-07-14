"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { requireAuthorizedBranchId } from "@/lib/auth/branch-access";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AssortmentService } from "@/features/products/services/assortment.service";
import { getErrorMessage } from "@/lib/errors/app-error";

const branchSchema = z.object({
  branchId: z.string().uuid(),
});

const setVariantSchema = z.object({
  branchId: z.string().uuid(),
  variantId: z.string().uuid(),
  isActive: z.boolean().optional(),
  sellingPrice: z.number().min(0).nullable().optional(),
});

async function authorizeAssortmentBranch(
  session: Awaited<ReturnType<typeof requireSession>>,
  branchId: string,
) {
  const authorizedBranchId = requireAuthorizedBranchId(
    session.user.branchIds,
    branchId,
  );
  // Authorize against the target branch, not only the active session branch.
  await authorize(session.user.id, PERMISSIONS.PRODUCTS.UPDATE, {
    branchId: authorizedBranchId,
  });
  return authorizedBranchId;
}

export async function getAssortmentCatalogueAction(
  branchId: string,
  search?: string,
) {
  const session = await requireSession();
  const data = branchSchema.parse({ branchId });
  const authorizedBranchId = await authorizeAssortmentBranch(
    session,
    data.branchId,
  );
  return AssortmentService.listCatalogue(
    session.user.organizationId,
    authorizedBranchId,
    { search },
  );
}

export async function setAssortmentVariantAction(
  input: z.infer<typeof setVariantSchema>,
) {
  try {
    const session = await requireSession();
    const data = setVariantSchema.parse(input);
    const authorizedBranchId = await authorizeAssortmentBranch(
      session,
      data.branchId,
    );
    await AssortmentService.setVariant(
      session.user.organizationId,
      authorizedBranchId,
      data.variantId,
      { isActive: data.isActive, sellingPrice: data.sellingPrice },
    );
    revalidatePath("/settings/assortment");
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: getErrorMessage(e) };
  }
}

export async function enableAllAssortmentAction(branchId: string) {
  try {
    const session = await requireSession();
    const data = branchSchema.parse({ branchId });
    const authorizedBranchId = await authorizeAssortmentBranch(
      session,
      data.branchId,
    );
    const result = await AssortmentService.enableAll(
      session.user.organizationId,
      authorizedBranchId,
    );
    revalidatePath("/settings/assortment");
    return { success: true as const, count: result.count };
  } catch (e) {
    return { success: false as const, error: getErrorMessage(e) };
  }
}

export async function clearAssortmentAction(branchId: string) {
  try {
    const session = await requireSession();
    const data = branchSchema.parse({ branchId });
    const authorizedBranchId = await authorizeAssortmentBranch(
      session,
      data.branchId,
    );
    const result = await AssortmentService.clearAssortment(
      session.user.organizationId,
      authorizedBranchId,
    );
    revalidatePath("/settings/assortment");
    return { success: true as const, count: result.count };
  } catch (e) {
    return { success: false as const, error: getErrorMessage(e) };
  }
}

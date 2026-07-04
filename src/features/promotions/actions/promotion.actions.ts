"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBranchSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getErrorMessage } from "@/lib/errors/app-error";
import { CouponAdminService, PromotionService } from "@/features/promotions/services/promotion.service";

const promoSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.coerce.number().positive(),
  minPurchase: z.coerce.number().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

const couponSchema = z.object({
  code: z.string().min(2),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.coerce.number().positive(),
  maxUses: z.coerce.number().int().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

export async function createPromotionAction(input: z.infer<typeof promoSchema>) {
  try {
    const session = await requireBranchSession(PERMISSIONS.SETTINGS.COMPANY_UPDATE);
    const data = promoSchema.parse(input);
    await PromotionService.create(session.user.organizationId, {
      ...data,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    });
    revalidatePath("/settings/promotions");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function createCouponAction(input: z.infer<typeof couponSchema>) {
  try {
    const session = await requireBranchSession(PERMISSIONS.SETTINGS.COMPANY_UPDATE);
    const data = couponSchema.parse(input);
    await CouponAdminService.create(session.user.organizationId, {
      ...data,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    });
    revalidatePath("/settings/promotions");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

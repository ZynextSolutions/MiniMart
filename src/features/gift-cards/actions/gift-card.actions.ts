"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBranchSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getErrorMessage } from "@/lib/errors/app-error";
import { GiftCardService } from "@/features/gift-cards/services/gift-card.service";

const schema = z.object({
  customerId: z.string().uuid(),
  initialBalance: z.coerce.number().positive(),
  expiresAt: z.string().optional(),
});

export async function issueGiftCardAction(input: z.infer<typeof schema>) {
  try {
    const session = await requireBranchSession(PERMISSIONS.CUSTOMERS.MANAGE);
    const data = schema.parse(input);
    const card = await GiftCardService.issue(session.user.organizationId, {
      customerId: data.customerId,
      initialBalance: data.initialBalance,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    });
    revalidatePath("/settings/gift-cards");
    return { success: true, code: card.code };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

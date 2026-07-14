"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getErrorMessage } from "@/lib/errors/app-error";
import { AccountMappingService } from "@/lib/services/account-mapping-service";
import {
  ACCOUNT_MAPPING_KEYS,
  DEFAULT_ACCOUNT_MAPPING,
  type AccountMapping,
} from "@/platform/onboarding/default-account-mapping";

const accountMappingSchema = z.object(
  ACCOUNT_MAPPING_KEYS.reduce(
    (acc, key) => {
      acc[key] = z.string().min(1, "Account code is required");
      return acc;
    },
    {} as Record<(typeof ACCOUNT_MAPPING_KEYS)[number], z.ZodString>,
  ),
);

export async function getAccountMappingSettingsAction() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.SETTINGS.FISCAL_MANAGE);

  const [mapping, accounts] = await Promise.all([
    AccountMappingService.getAccountMapping(session.user.organizationId),
    AccountMappingService.listActiveAccounts(session.user.organizationId),
  ]);

  return { mapping, accounts };
}

export async function updateAccountMappingAction(input: AccountMapping) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.SETTINGS.FISCAL_MANAGE);

    const mapping = accountMappingSchema.parse(input);
    await AccountMappingService.setAccountMapping(
      session.user.organizationId,
      mapping,
      session.user.id,
    );

    revalidatePath("/settings/account-mapping");
    revalidatePath("/pos");
    return { success: true as const, mapping };
  } catch (error) {
    return { success: false as const, error: getErrorMessage(error) };
  }
}

export async function resetAccountMappingAction() {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.SETTINGS.FISCAL_MANAGE);

    const mapping = await AccountMappingService.setAccountMapping(
      session.user.organizationId,
      DEFAULT_ACCOUNT_MAPPING,
      session.user.id,
    );

    revalidatePath("/settings/account-mapping");
    revalidatePath("/pos");
    return { success: true as const, mapping };
  } catch (error) {
    return { success: false as const, error: getErrorMessage(error) };
  }
}

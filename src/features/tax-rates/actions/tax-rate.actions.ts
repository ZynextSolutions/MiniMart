"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { TaxRateService } from "@/features/tax-rates/services/tax-rate.service";
import { TaxSettingsService } from "@/lib/services/tax-settings-service";
import { getErrorMessage } from "@/lib/errors/app-error";
import type { TaxMode } from "@/lib/utils/tax";

const schema = z.object({
  name: z.string().min(1),
  rate: z.coerce.number().min(0).max(1),
  isDefault: z.boolean().optional(),
});

const updateSchema = schema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

const taxModeSchema = z.enum(["EXCLUSIVE", "INCLUSIVE"]);

export async function listTaxRatesAction() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.SETTINGS.TAX_MANAGE);
  const taxRates = await TaxRateService.list(session.user.organizationId);
  return taxRates.map((taxRate) => ({
    id: taxRate.id,
    name: taxRate.name,
    rate: taxRate.rate.toString(),
    isDefault: taxRate.isDefault,
    isActive: taxRate.isActive,
    _count: taxRate._count,
  }));
}

export async function getTaxModeAction(): Promise<TaxMode> {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.SETTINGS.TAX_MANAGE);
  return TaxSettingsService.getTaxMode(session.user.organizationId);
}

export async function updateTaxModeAction(mode: TaxMode) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.SETTINGS.TAX_MANAGE);
    const parsedMode = taxModeSchema.parse(mode);
    await TaxSettingsService.setTaxMode(session.user.organizationId, parsedMode);
    revalidatePath("/settings/taxes");
    revalidatePath("/pos");
    revalidatePath("/products/new");
    revalidatePath("/products/[id]/edit");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function createTaxRateAction(input: z.infer<typeof schema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.SETTINGS.TAX_MANAGE);
    const data = schema.parse(input);
    const taxRate = await TaxRateService.create(
      { ...data, organizationId: session.user.organizationId },
      session.user.id,
    );
    revalidatePath("/settings/taxes");
    return { success: true, taxRateId: taxRate.id };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateTaxRateAction(input: z.infer<typeof updateSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.SETTINGS.TAX_MANAGE);
    const { id, ...data } = updateSchema.parse(input);
    const taxRate = await TaxRateService.update(
      id,
      session.user.organizationId,
      data,
      session.user.id,
    );
    revalidatePath("/settings/taxes");
    return { success: true, taxRateId: taxRate.id };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteTaxRateAction(id: string) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.SETTINGS.TAX_MANAGE);
    await TaxRateService.softDelete(id, session.user.organizationId, session.user.id);
    revalidatePath("/settings/taxes");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

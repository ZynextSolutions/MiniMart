"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { OrganizationService } from "@/features/settings/services/organization.service";
import { getErrorMessage } from "@/lib/errors/app-error";
import { unstable_update } from "@/lib/auth/auth";

const updateOrgSchema = z.object({
  name: z.string().min(1),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().length(2).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
});

export async function updateOrganizationAction(
  input: z.infer<typeof updateOrgSchema>,
) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.SETTINGS.COMPANY_UPDATE);

    const data = updateOrgSchema.parse(input);
    const org = await OrganizationService.update(
      session.user.organizationId,
      {
        ...data,
        currency: data.currency?.toUpperCase(),
        email: data.email || undefined,
        website: data.website || undefined,
      },
      session.user.id,
    );

    revalidatePath("/settings/company");
    revalidatePath("/");
    await unstable_update({ user: { currency: org.currency } });
    return { success: true, organization: org };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getOrganizationAction() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.SETTINGS.COMPANY_VIEW);
  return OrganizationService.getById(session.user.organizationId);
}

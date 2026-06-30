"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CustomerService } from "@/features/customers/services/customer.service";
import { getErrorMessage } from "@/lib/errors/app-error";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  membershipTier: z.string().optional(),
  creditLimit: z.coerce.number().min(0).optional(),
});

const updateSchema = schema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export async function listCustomersAction(params?: { search?: string; page?: number }) {
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.CUSTOMERS.VIEW);
  return CustomerService.list(session.user.organizationId, params);
}

export async function createCustomerAction(input: z.infer<typeof schema>) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.CUSTOMERS.MANAGE);
    const data = schema.parse(input);
    const customer = await CustomerService.create(
      {
        organizationId: session.user.organizationId,
        ...data,
        email: data.email || undefined,
      },
      session.user.id,
    );
    revalidatePath("/customers");
    return { success: true, customer };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateCustomerAction(input: z.infer<typeof updateSchema>) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.CUSTOMERS.MANAGE);
    const { id, ...data } = updateSchema.parse(input);
    const customer = await CustomerService.update(
      id,
      session.user.organizationId,
      { ...data, email: data.email || undefined },
      session.user.id,
    );
    revalidatePath("/customers");
    return { success: true, customer };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteCustomerAction(id: string) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.CUSTOMERS.MANAGE);
    await CustomerService.softDelete(id, session.user.organizationId, session.user.id);
    revalidatePath("/customers");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { OrganizationProvisioningService } from "@/platform/onboarding/organization-provisioning.service";
import { getPrismaBase } from "@/platform/tenant/tenant-prisma";
import { getErrorMessage, ValidationError } from "@/lib/errors/app-error";
import { strongPasswordSchema } from "@/lib/auth/password-schema";
import { serializePlan } from "@/lib/utils/serialize-prisma";
import bcrypt from "bcryptjs";
import {
  enforceInviteRateLimit,
  enforceSignupRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

const signupSchema = z.object({
  organizationName: z.string().min(2).max(100),
  slug: z.string().min(2).max(48).regex(/^[a-z0-9-]+$/),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: strongPasswordSchema,
  planSlug: z.string().default("starter"),
});

export async function signupAction(input: z.infer<typeof signupSchema>) {
  try {
    if (process.env.SIGNUP_DISABLED === "true") {
      throw new ValidationError("Public signup is currently disabled");
    }

    const headerStore = await headers();
    const ip = getClientIp({ headers: headerStore });
    await enforceSignupRateLimit(ip);

    const data = signupSchema.parse(input);
    const result = await OrganizationProvisioningService.provision({
      name: data.organizationName,
      slug: data.slug,
      ownerEmail: data.email,
      ownerPassword: data.password,
      ownerFirstName: data.firstName,
      ownerLastName: data.lastName,
      planSlug: data.planSlug,
    });

    return {
      success: true,
      organizationId: result.org.id,
      slug: result.org.slug,
    };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getAvailablePlansAction() {
  const plans = await getPrismaBase().plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      billingInterval: true,
      trialDays: true,
      limits: true,
      features: true,
    },
  });
  return plans.map(serializePlan);
}

const inviteAcceptSchema = z.object({
  token: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: strongPasswordSchema,
});

export async function acceptInviteAction(input: z.infer<typeof inviteAcceptSchema>) {
  try {
    const headerStore = await headers();
    const ip = getClientIp({ headers: headerStore });
    await enforceInviteRateLimit(ip);

    const data = inviteAcceptSchema.parse(input);
    const prisma = getPrismaBase();

    const invite = await prisma.organizationInvite.findUnique({
      where: { token: data.token },
      include: { organization: true },
    });

    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return { success: false, error: "Invite is invalid or expired" };
    }

    const existing = await prisma.user.findFirst({
      where: {
        organizationId: invite.organizationId,
        email: invite.email,
        deletedAt: null,
      },
    });
    if (existing) {
      return { success: false, error: "User already exists in this organization" };
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: invite.organizationId,
          email: invite.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          isActive: true,
        },
      });

      await tx.userBranchRole.create({
        data: {
          userId: user.id,
          branchId: invite.branchId,
          roleId: invite.roleId,
        },
      });

      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    });

    return { success: true, organizationSlug: invite.organization.slug };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getInviteByTokenAction(token: string) {
  const headerStore = await headers();
  const ip = getClientIp({ headers: headerStore });
  await enforceInviteRateLimit(ip);

  const invite = await getPrismaBase().organizationInvite.findUnique({
    where: { token },
    include: { organization: { select: { name: true, slug: true } } },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return null;
  }
  return {
    email: invite.email,
    organizationName: invite.organization.name,
    organizationSlug: invite.organization.slug,
    expiresAt: invite.expiresAt.toISOString(),
  };
}

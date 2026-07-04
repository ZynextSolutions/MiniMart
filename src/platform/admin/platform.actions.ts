"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import { FeatureFlagService } from "@/platform/feature-flags/feature-flag.service";
import { ModuleAccessService } from "@/platform/modules/module-access.service";
import type { ModuleOverrideState } from "@/platform/modules/module-access.service";
import type { PlatformModuleKey } from "@/platform/modules/platform-modules";
import { OrganizationProvisioningService } from "@/platform/onboarding/organization-provisioning.service";
import { requirePlatformSession } from "@/platform/auth/platform-session";
import { PLATFORM_ROLES, requirePlatformRole } from "@/platform/auth/platform-roles";
import { getErrorMessage } from "@/lib/errors/app-error";

const orgStatusSchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(["ACTIVE", "TRIAL", "SUSPENDED", "CANCELLED"]),
});

const orgUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  country: z.string().length(2).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
});

const createOrgSchema = z.object({
  organizationName: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  ownerFirstName: z.string().min(1),
  ownerLastName: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  planSlug: z.string().default("starter"),
});

const planSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
  trialDays: z.coerce.number().int().min(0),
  maxBranches: z.coerce.number().int().min(1),
  maxUsers: z.coerce.number().int().min(1),
  maxProducts: z.coerce.number().int().min(1),
  features: z.string().optional(),
  modules: z.record(z.string(), z.boolean()).optional(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int(),
});

const subscriptionUpdateSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid().optional(),
  status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"]).optional(),
  trialEndsAt: z.string().optional().nullable(),
  currentPeriodEnd: z.string().optional(),
});

const platformUserSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["SUPER_ADMIN", "SUPPORT", "BILLING"]),
  isActive: z.boolean().optional(),
});

const announcementSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(["info", "warning", "success", "error"]).default("info"),
  organizationId: z.string().uuid().optional().nullable(),
  isActive: z.boolean(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
});

const supportTicketCreateSchema = z.object({
  organizationId: z.string().uuid(),
  subject: z.string().min(1),
  message: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

const supportTicketUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
});

const supportTicketMessageSchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().min(1),
});

const featureFlagSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  isEnabled: z.boolean(),
});

const featureFlagOverrideSchema = z.object({
  organizationId: z.string().uuid(),
  key: z.string().min(1),
  isEnabled: z.boolean(),
});

const orgModuleOverrideSchema = z.object({
  organizationId: z.string().uuid(),
  moduleKey: z.string().min(1),
  state: z.enum(["inherit", "enabled", "disabled"]),
});

export async function updateOrganizationStatusAction(input: z.infer<typeof orgStatusSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.OPS);
    const data = orgStatusSchema.parse(input);
    await PlatformAdminService.updateOrganizationStatus(
      data.organizationId,
      data.status,
      session.user.id,
    );
    revalidatePath("/platform/organizations");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateOrganizationAction(input: z.infer<typeof orgUpdateSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.OPS);
    const data = orgUpdateSchema.parse(input);
    await PlatformAdminService.updateOrganization(
      data.id,
      {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone,
        country: data.country,
        currency: data.currency,
        timezone: data.timezone,
      },
      session.user.id,
    );
    revalidatePath("/platform/organizations");
    revalidatePath(`/platform/organizations/${data.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteOrganizationAction(organizationId: string) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.ADMIN);
    await PlatformAdminService.softDeleteOrganization(organizationId, session.user.id);
    revalidatePath("/platform/organizations");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createOrganizationAction(input: z.infer<typeof createOrgSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.OPS);
    const data = createOrgSchema.parse(input);
    const result = await OrganizationProvisioningService.provision({
      name: data.organizationName,
      slug: data.slug,
      ownerEmail: data.ownerEmail,
      ownerPassword: data.ownerPassword,
      ownerFirstName: data.ownerFirstName,
      ownerLastName: data.ownerLastName,
      planSlug: data.planSlug,
    });
    revalidatePath("/platform/organizations");
    return { success: true, organizationId: result.org.id, slug: result.org.slug };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function upsertPlanAction(input: z.infer<typeof planSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.BILLING);
    const data = planSchema.parse(input);
    const features = data.features
      ? data.features.split(",").map((f) => f.trim()).filter(Boolean)
      : [];

    await PlatformAdminService.upsertPlan(
      {
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        price: data.price,
        billingInterval: data.billingInterval,
        trialDays: data.trialDays,
        limits: {
          maxBranches: data.maxBranches,
          maxUsers: data.maxUsers,
          maxProducts: data.maxProducts,
          ...(data.modules ? { modules: data.modules } : {}),
        },
        features,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
      session.user.id,
    );
    revalidatePath("/platform/plans");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deletePlanAction(planId: string) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.BILLING);
    const result = await PlatformAdminService.deletePlan(planId, session.user.id);
    revalidatePath("/platform/plans");
    return {
      success: true,
      deactivated: result.deactivated,
      message: result.deactivated
        ? "Plan has active subscriptions and was deactivated instead."
        : "Plan deleted.",
    };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateSubscriptionAction(input: z.infer<typeof subscriptionUpdateSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.BILLING);
    const data = subscriptionUpdateSchema.parse(input);
    await PlatformAdminService.updateSubscription(
      data.id,
      {
        planId: data.planId,
        status: data.status,
        trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : data.trialEndsAt === null ? null : undefined,
        currentPeriodEnd: data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : undefined,
      },
      session.user.id,
    );
    revalidatePath("/platform/subscriptions");
    revalidatePath("/platform/organizations");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function upsertPlatformUserAction(input: z.infer<typeof platformUserSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.ADMIN);
    const data = platformUserSchema.parse(input);

    if (data.id) {
      if (!data.password && data.isActive === undefined && !data.firstName && !data.lastName && !data.role) {
        return { success: false, error: "Nothing to update" };
      }
      await PlatformAdminService.updatePlatformUser(
        data.id,
        {
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          isActive: data.isActive,
          password: data.password,
        },
        session.user.id,
      );
    } else {
      if (!data.password) {
        return { success: false, error: "Password is required for new users" };
      }
      await PlatformAdminService.createPlatformUser(
        {
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        },
        session.user.id,
      );
    }

    revalidatePath("/platform/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deletePlatformUserAction(userId: string) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.ADMIN);
    await PlatformAdminService.deletePlatformUser(userId, session.user.id);
    revalidatePath("/platform/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function upsertAnnouncementAction(input: z.infer<typeof announcementSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.OPS);
    const data = announcementSchema.parse(input);
    const payload = {
      title: data.title,
      message: data.message,
      type: data.type,
      organizationId: data.organizationId ?? null,
      isActive: data.isActive,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
    };

    if (data.id) {
      await PlatformAdminService.updateAnnouncement(data.id, payload, session.user.id);
    } else {
      await PlatformAdminService.createAnnouncement(payload, session.user.id);
    }

    revalidatePath("/platform/announcements");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteAnnouncementAction(id: string) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.OPS);
    await PlatformAdminService.deleteAnnouncement(id, session.user.id);
    revalidatePath("/platform/announcements");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createSupportTicketAction(input: z.infer<typeof supportTicketCreateSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.OPS);
    const data = supportTicketCreateSchema.parse(input);
    const ticket = await PlatformAdminService.createSupportTicket(
      {
        ...data,
        createdByEmail: session.user.email,
        createdByName: session.user.name ?? session.user.email,
      },
      session.user.id,
    );
    revalidatePath("/platform/support");
    return { success: true, ticketId: ticket.id };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateSupportTicketAction(input: z.infer<typeof supportTicketUpdateSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.OPS);
    const data = supportTicketUpdateSchema.parse(input);
    await PlatformAdminService.updateSupportTicket(
      data.id,
      {
        status: data.status,
        priority: data.priority,
        assignedToId: data.assignedToId,
      },
      session.user.id,
    );
    revalidatePath("/platform/support");
    revalidatePath(`/platform/support/${data.id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function addSupportTicketMessageAction(input: z.infer<typeof supportTicketMessageSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.OPS);
    const data = supportTicketMessageSchema.parse(input);
    await PlatformAdminService.addSupportTicketMessage(
      data.ticketId,
      {
        message: data.message,
        authorEmail: session.user.email,
        authorName: session.user.name ?? session.user.email,
        platformUserId: session.user.id,
      },
      session.user.id,
    );
    revalidatePath("/platform/support");
    revalidatePath(`/platform/support/${data.ticketId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteSupportTicketAction(id: string) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.OPS);
    await PlatformAdminService.deleteSupportTicket(id, session.user.id);
    revalidatePath("/platform/support");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function upsertFeatureFlagAction(input: z.infer<typeof featureFlagSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.ADMIN);
    const data = featureFlagSchema.parse(input);
    await FeatureFlagService.upsert(data, session.user.id);
    revalidatePath("/platform/feature-flags");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteFeatureFlagAction(id: string) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.ADMIN);
    await PlatformAdminService.deleteFeatureFlag(id, session.user.id);
    revalidatePath("/platform/feature-flags");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function setFeatureFlagOverrideAction(input: z.infer<typeof featureFlagOverrideSchema>) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.ADMIN);
    const data = featureFlagOverrideSchema.parse(input);
    await FeatureFlagService.setOrgOverride(
      data.organizationId,
      data.key,
      data.isEnabled,
      session.user.id,
    );
    revalidatePath("/platform/feature-flags");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function removeFeatureFlagOverrideAction(overrideId: string) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.ADMIN);
    await PlatformAdminService.removeFeatureFlagOverride(overrideId, session.user.id);
    revalidatePath("/platform/feature-flags");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function setOrgModuleOverrideAction(
  input: z.infer<typeof orgModuleOverrideSchema>,
) {
  try {
    const session = await requirePlatformRole(...PLATFORM_ROLES.ADMIN);
    const data = orgModuleOverrideSchema.parse(input);
    await ModuleAccessService.setOrgModuleOverride(
      data.organizationId,
      data.moduleKey as PlatformModuleKey,
      data.state as ModuleOverrideState,
      session.user.id,
    );
    revalidatePath(`/platform/organizations/${data.organizationId}`);
    revalidatePath("/platform/feature-flags");
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

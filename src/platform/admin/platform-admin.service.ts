import { getPrismaBase } from "@/platform/tenant/tenant-prisma";
import type {
  OrganizationStatus,
  PlatformUserRole,
  SubscriptionStatus,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";

export class PlatformAdminService {
  static async getDashboardStats() {
    const prisma = getPrismaBase();
    const [
      totalOrgs,
      activeTrials,
      activeSubscriptions,
      suspendedOrgs,
      totalUsers,
      openTickets,
    ] = await Promise.all([
      prisma.organization.count({ where: { deletedAt: null } }),
      prisma.subscription.count({ where: { status: "TRIAL" } }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.organization.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.supportTicket.count({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
    ]);

    return {
      totalOrgs,
      activeTrials,
      activeSubscriptions,
      suspendedOrgs,
      totalUsers,
      openTickets,
      mrr: 0,
    };
  }

  static async listOrganizations(params?: {
    search?: string;
    status?: OrganizationStatus;
    page?: number;
    limit?: number;
  }) {
    const prisma = getPrismaBase();
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" as const } },
              { slug: { contains: params.search, mode: "insensitive" as const } },
              { email: { contains: params.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          subscription: {
            select: {
              status: true,
              plan: { select: { name: true } },
            },
          },
          _count: { select: { users: true, branches: true, products: true } },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  static async getOrganization(id: string) {
    const prisma = getPrismaBase();
    return prisma.organization.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true, events: { orderBy: { createdAt: "desc" }, take: 10 } } },
        _count: { select: { users: true, branches: true, products: true, warehouses: true } },
      },
    });
  }

  static async updateOrganizationStatus(
    id: string,
    status: OrganizationStatus,
    actorId: string,
  ) {
    const prisma = getPrismaBase();
    const before = await prisma.organization.findUnique({ where: { id } });
    const updated = await prisma.organization.update({
      where: { id },
      data: { status },
    });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "UPDATE_STATUS",
        entityType: "Organization",
        entityId: id,
        organizationId: id,
        before: before ? { status: before.status } : undefined,
        after: { status },
      },
    });

    return updated;
  }

  static async listPlans() {
    return getPrismaBase().plan.findMany({ orderBy: { sortOrder: "asc" } });
  }

  static async upsertPlan(
    data: {
      id?: string;
      name: string;
      slug: string;
      description?: string;
      price: number;
      billingInterval: "MONTHLY" | "YEARLY";
      trialDays: number;
      limits: Record<string, number | Record<string, boolean>>;
      features: string[];
      isActive: boolean;
      sortOrder: number;
    },
    actorId: string,
  ) {
    const prisma = getPrismaBase();

    let limits = data.limits;
    if (data.id) {
      const existing = await prisma.plan.findUnique({ where: { id: data.id } });
      const existingLimits = (existing?.limits as Record<
        string,
        number | Record<string, boolean>
      >) ?? {};
      limits = {
        ...existingLimits,
        ...data.limits,
      };
    }

    const payload = {
      name: data.name,
      slug: data.slug,
      description: data.description,
      price: data.price,
      billingInterval: data.billingInterval,
      trialDays: data.trialDays,
      limits,
      features: data.features,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    };

    const result = data.id
      ? await prisma.plan.update({ where: { id: data.id }, data: payload })
      : await prisma.plan.create({ data: payload });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: data.id ? "UPDATE" : "CREATE",
        entityType: "Plan",
        entityId: result.id,
        after: payload,
      },
    });

    return result;
  }

  static async listSubscriptions(params?: {
    status?: SubscriptionStatus;
    page?: number;
    limit?: number;
  }) {
    const prisma = getPrismaBase();
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const where = params?.status ? { status: params.status } : {};

    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          plan: { select: { name: true } },
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  static async listPlatformUsers() {
    return getPrismaBase().platformUser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  static async listAuditLogs(params?: { page?: number; limit?: number }) {
    const prisma = getPrismaBase();
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;

    const [items, total] = await Promise.all([
      prisma.platformAuditLog.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          platformUser: {
            select: { email: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.platformAuditLog.count(),
    ]);

    return { items, total, page, limit };
  }

  static async listAnnouncements() {
    return getPrismaBase().announcement.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  static async listSupportTickets(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const prisma = getPrismaBase();
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const where = params?.status
      ? { status: params.status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" }
      : {};

    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          organization: { select: { name: true, slug: true } },
          _count: { select: { messages: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  static async listOrganizationOptions() {
    return getPrismaBase().organization.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
  }

  static async updateOrganization(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      country?: string;
      currency?: string;
      timezone?: string;
    },
    actorId: string,
  ) {
    const prisma = getPrismaBase();
    const before = await prisma.organization.findUnique({ where: { id } });
    if (!before || before.deletedAt) throw new NotFoundError("Organization not found");

    const updated = await prisma.organization.update({
      where: { id },
      data,
    });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "UPDATE",
        entityType: "Organization",
        entityId: id,
        organizationId: id,
        before: { name: before.name, email: before.email },
        after: data,
      },
    });

    return updated;
  }

  static async softDeleteOrganization(id: string, actorId: string) {
    const prisma = getPrismaBase();
    const before = await prisma.organization.findUnique({ where: { id } });
    if (!before || before.deletedAt) throw new NotFoundError("Organization not found");

    const updated = await prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "DELETE",
        entityType: "Organization",
        entityId: id,
        organizationId: id,
      },
    });

    return updated;
  }

  static async deletePlan(id: string, actorId: string) {
    const prisma = getPrismaBase();
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!plan) throw new NotFoundError("Plan not found");

    if (plan._count.subscriptions > 0) {
      const updated = await prisma.plan.update({
        where: { id },
        data: { isActive: false },
      });
      await prisma.platformAuditLog.create({
        data: {
          platformUserId: actorId,
          action: "DEACTIVATE",
          entityType: "Plan",
          entityId: id,
          after: { isActive: false },
        },
      });
      return { deactivated: true, plan: updated };
    }

    await prisma.plan.delete({ where: { id } });
    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "DELETE",
        entityType: "Plan",
        entityId: id,
      },
    });
    return { deactivated: false, plan: null };
  }

  static async getSubscription(id: string) {
    return getPrismaBase().subscription.findUnique({
      where: { id },
      include: {
        plan: true,
        organization: { select: { id: true, name: true, slug: true } },
        events: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
  }

  static async updateSubscription(
    id: string,
    data: {
      planId?: string;
      status?: SubscriptionStatus;
      trialEndsAt?: Date | null;
      currentPeriodEnd?: Date;
    },
    actorId: string,
  ) {
    const prisma = getPrismaBase();
    const before = await prisma.subscription.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("Subscription not found");

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
      },
      include: {
        plan: { select: { name: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    if (data.status && data.status !== before.status) {
      await prisma.subscriptionEvent.create({
        data: {
          subscriptionId: id,
          status: data.status,
          note: "Updated by platform admin",
        },
      });
    }

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "UPDATE",
        entityType: "Subscription",
        entityId: id,
        organizationId: before.organizationId,
        before: { planId: before.planId, status: before.status },
        after: data,
      },
    });

    return updated;
  }

  static async createPlatformUser(
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: PlatformUserRole;
    },
    actorId: string,
  ) {
    const prisma = getPrismaBase();
    const email = data.email.toLowerCase();
    const existing = await prisma.platformUser.findUnique({ where: { email } });
    if (existing) throw new ConflictError("Email already in use");

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.platformUser.create({
      data: {
        email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "CREATE",
        entityType: "PlatformUser",
        entityId: user.id,
        after: { email: user.email, role: user.role },
      },
    });

    return user;
  }

  static async updatePlatformUser(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      role?: PlatformUserRole;
      isActive?: boolean;
      password?: string;
    },
    actorId: string,
  ) {
    const prisma = getPrismaBase();
    const before = await prisma.platformUser.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("Platform user not found");

    const payload: {
      firstName?: string;
      lastName?: string;
      role?: PlatformUserRole;
      isActive?: boolean;
      passwordHash?: string;
    } = {
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      isActive: data.isActive,
    };

    if (data.password) {
      payload.passwordHash = await bcrypt.hash(data.password, 12);
    }

    const updated = await prisma.platformUser.update({
      where: { id },
      data: payload,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "UPDATE",
        entityType: "PlatformUser",
        entityId: id,
        before: { role: before.role, isActive: before.isActive },
        after: { role: updated.role, isActive: updated.isActive },
      },
    });

    return updated;
  }

  static async deletePlatformUser(id: string, actorId: string) {
    const prisma = getPrismaBase();
    const user = await prisma.platformUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundError("Platform user not found");

    const activeAdmins = await prisma.platformUser.count({
      where: { isActive: true, role: "SUPER_ADMIN" },
    });
    if (user.role === "SUPER_ADMIN" && user.isActive && activeAdmins <= 1) {
      throw new ConflictError("Cannot delete the last active super admin");
    }

    const updated = await prisma.platformUser.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "DEACTIVATE",
        entityType: "PlatformUser",
        entityId: id,
      },
    });

    return updated;
  }

  static async createAnnouncement(
    data: {
      title: string;
      message: string;
      type: string;
      organizationId?: string | null;
      isActive: boolean;
      startsAt?: Date | null;
      endsAt?: Date | null;
    },
    actorId: string,
  ) {
    const prisma = getPrismaBase();
    const result = await prisma.announcement.create({ data });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "CREATE",
        entityType: "Announcement",
        entityId: result.id,
        organizationId: result.organizationId ?? undefined,
        after: { title: result.title, isActive: result.isActive },
      },
    });

    return result;
  }

  static async updateAnnouncement(
    id: string,
    data: {
      title?: string;
      message?: string;
      type?: string;
      organizationId?: string | null;
      isActive?: boolean;
      startsAt?: Date | null;
      endsAt?: Date | null;
    },
    actorId: string,
  ) {
    const prisma = getPrismaBase();
    const result = await prisma.announcement.update({ where: { id }, data });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "UPDATE",
        entityType: "Announcement",
        entityId: id,
        organizationId: result.organizationId ?? undefined,
        after: data,
      },
    });

    return result;
  }

  static async deleteAnnouncement(id: string, actorId: string) {
    const prisma = getPrismaBase();
    const before = await prisma.announcement.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("Announcement not found");

    await prisma.announcement.delete({ where: { id } });
    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "DELETE",
        entityType: "Announcement",
        entityId: id,
        organizationId: before.organizationId ?? undefined,
      },
    });
  }

  static async getSupportTicket(id: string) {
    return getPrismaBase().supportTicket.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  static async createSupportTicket(
    data: {
      organizationId: string;
      subject: string;
      message: string;
      priority: SupportTicketPriority;
      createdByEmail: string;
      createdByName: string;
    },
    actorId: string,
  ) {
    const prisma = getPrismaBase();
    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId: data.organizationId,
        subject: data.subject,
        priority: data.priority,
        createdByEmail: data.createdByEmail,
        createdByName: data.createdByName,
        messages: {
          create: {
            message: data.message,
            isFromPlatform: true,
            authorEmail: data.createdByEmail,
            authorName: data.createdByName,
            platformUserId: actorId,
          },
        },
      },
      include: {
        organization: { select: { name: true, slug: true } },
        _count: { select: { messages: true } },
      },
    });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "CREATE",
        entityType: "SupportTicket",
        entityId: ticket.id,
        organizationId: data.organizationId,
        after: { subject: data.subject },
      },
    });

    return ticket;
  }

  static async updateSupportTicket(
    id: string,
    data: {
      status?: SupportTicketStatus;
      priority?: SupportTicketPriority;
      assignedToId?: string | null;
    },
    actorId: string,
  ) {
    const prisma = getPrismaBase();
    const before = await prisma.supportTicket.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("Support ticket not found");

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === "RESOLVED" || data.status === "CLOSED"
          ? { resolvedAt: new Date() }
          : {}),
      },
      include: {
        organization: { select: { name: true, slug: true } },
        _count: { select: { messages: true } },
      },
    });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "UPDATE",
        entityType: "SupportTicket",
        entityId: id,
        organizationId: before.organizationId,
        before: { status: before.status, priority: before.priority },
        after: data,
      },
    });

    return updated;
  }

  static async addSupportTicketMessage(
    ticketId: string,
    data: {
      message: string;
      authorEmail: string;
      authorName: string;
      platformUserId: string;
    },
    actorId: string,
  ) {
    const prisma = getPrismaBase();
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundError("Support ticket not found");

    const msg = await prisma.supportTicketMessage.create({
      data: {
        ticketId,
        message: data.message,
        isFromPlatform: true,
        authorEmail: data.authorEmail,
        authorName: data.authorName,
        platformUserId: data.platformUserId,
      },
    });

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status,
        updatedAt: new Date(),
      },
    });

    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "REPLY",
        entityType: "SupportTicket",
        entityId: ticketId,
        organizationId: ticket.organizationId,
      },
    });

    return msg;
  }

  static async deleteSupportTicket(id: string, actorId: string) {
    const prisma = getPrismaBase();
    const before = await prisma.supportTicket.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("Support ticket not found");

    await prisma.supportTicket.delete({ where: { id } });
    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "DELETE",
        entityType: "SupportTicket",
        entityId: id,
        organizationId: before.organizationId,
      },
    });
  }

  static async deleteFeatureFlag(id: string, actorId: string) {
    const prisma = getPrismaBase();
    const flag = await prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundError("Feature flag not found");

    await prisma.featureFlag.delete({ where: { id } });
    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "DELETE",
        entityType: "FeatureFlag",
        entityId: id,
      },
    });
  }

  static async listFeatureFlagOverrides(featureFlagId: string) {
    return getPrismaBase().featureFlagOverride.findMany({
      where: { featureFlagId },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { organization: { name: "asc" } },
    });
  }

  static async removeFeatureFlagOverride(id: string, actorId: string) {
    const prisma = getPrismaBase();
    const override = await prisma.featureFlagOverride.findUnique({
      where: { id },
      include: { featureFlag: true },
    });
    if (!override) throw new NotFoundError("Override not found");

    await prisma.featureFlagOverride.delete({ where: { id } });
    await prisma.platformAuditLog.create({
      data: {
        platformUserId: actorId,
        action: "DELETE_OVERRIDE",
        entityType: "FeatureFlag",
        entityId: override.featureFlagId,
        organizationId: override.organizationId,
      },
    });
  }
}

import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { assertRoleAssignable } from "@/lib/permissions/role-guards";
import { SYSTEM_ROLES } from "@/lib/permissions/roles";
import { AuditService } from "@/lib/services/audit-service";
import { PlanLimitsService } from "@/platform/subscriptions/plan-limits.service";
import type { Prisma } from "@prisma/client";

export interface ListUsersParams {
  organizationId: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

export class UserService {
  private static async getOrganizationOwnerId(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<string | null> {
    const organization = await tx.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { ownerUserId: true },
    });
    return organization?.ownerUserId ?? null;
  }

  private static async validateBranchRoles(
    tx: Prisma.TransactionClient,
    organizationId: string,
    branchRoles: { branchId: string; roleId: string }[],
  ) {
    for (const br of branchRoles) {
      const branch = await tx.branch.findFirst({
        where: {
          id: br.branchId,
          organizationId,
          deletedAt: null,
        },
      });
      if (!branch) throw new NotFoundError("Branch");

      const role = await tx.role.findFirst({
        where: {
          id: br.roleId,
          organizationId,
          deletedAt: null,
        },
      });
      if (!role) throw new NotFoundError("Role");
      assertRoleAssignable(role.name);
    }
  }

  static async list(params: ListUsersParams) {
    const { organizationId, page = 1, pageSize = 20, search } = params;
    const where: Prisma.UserWhereInput = {
      organizationId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          userBranchRoles: {
            include: {
              branch: { select: { id: true, name: true, code: true } },
              role: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map(({ passwordHash: _, ...user }) => user),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getById(id: string, organizationId: string) {
    const user = await prisma.user.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        userBranchRoles: {
          include: {
            branch: { select: { id: true, name: true, code: true } },
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) throw new NotFoundError("User");
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  static async create(
    data: {
      organizationId: string;
      email: string;
      passwordHash: string;
      firstName: string;
      lastName: string;
      phone?: string;
      branchRoles: { branchId: string; roleId: string }[];
    },
    actorId: string,
  ) {
    const existing = await prisma.user.findFirst({
      where: {
        organizationId: data.organizationId,
        email: data.email.toLowerCase(),
        deletedAt: null,
      },
    });

    if (existing) throw new ConflictError("Email already in use");

    await PlanLimitsService.checkLimit(data.organizationId, "maxUsers");

    const user = await prisma.$transaction(async (tx) => {
      await this.validateBranchRoles(tx, data.organizationId, data.branchRoles);

      const created = await tx.user.create({
        data: {
          organizationId: data.organizationId,
          email: data.email.toLowerCase(),
          passwordHash: data.passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          isActive: true,
        },
      });

      for (const br of data.branchRoles) {
        await tx.userBranchRole.create({
          data: {
            userId: created.id,
            branchId: br.branchId,
            roleId: br.roleId,
          },
        });
      }

      return created;
    });

    await AuditService.log({
      organizationId: data.organizationId,
      userId: actorId,
      action: "user.created",
      entityType: "User",
      entityId: user.id,
      after: { email: user.email, firstName: user.firstName, lastName: user.lastName },
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  static async update(
    id: string,
    organizationId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      isActive?: boolean;
      passwordHash?: string;
      branchRoles?: { branchId: string; roleId: string }[];
    },
    actorId: string,
  ) {
    const before = await this.getById(id, organizationId);

    const user = await prisma.$transaction(async (tx) => {
      const ownerUserId = await this.getOrganizationOwnerId(tx, organizationId);
      const isOrganizationOwner = ownerUserId === id;

      const updated = await tx.user.update({
        where: { id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          isActive: data.isActive,
          ...(data.passwordHash ? { passwordHash: data.passwordHash } : {}),
        },
      });

      if (isOrganizationOwner && data.isActive === false) {
        throw new ConflictError(
          "Transfer ownership before deactivating the organization owner",
        );
      }

      if (data.branchRoles) {
        if (isOrganizationOwner) {
          throw new ConflictError(
            "Organization owner role assignment cannot be edited from this form",
          );
        }
        const existingAssignments = await tx.userBranchRole.count({
          where: { userId: id },
        });
        if (existingAssignments > 1) {
          throw new ValidationError(
            "This user has multiple branch-role assignments and cannot be edited from this form",
          );
        }
        await this.validateBranchRoles(tx, organizationId, data.branchRoles);
        await tx.userBranchRole.deleteMany({ where: { userId: id } });
        for (const br of data.branchRoles) {
          await tx.userBranchRole.create({
            data: { userId: id, branchId: br.branchId, roleId: br.roleId },
          });
        }
      }

      return updated;
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "user.updated",
      entityType: "User",
      entityId: id,
      before: { email: before.email, isActive: before.isActive },
      after: { email: user.email, isActive: user.isActive },
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  static async softDelete(id: string, organizationId: string, actorId: string) {
    const before = await this.getById(id, organizationId);

    await prisma.$transaction(async (tx) => {
      const ownerUserId = await this.getOrganizationOwnerId(tx, organizationId);
      if (ownerUserId === id) {
        throw new ConflictError(
          "Transfer ownership before deleting the organization owner",
        );
      }

      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "user.deleted",
      entityType: "User",
      entityId: id,
      before: { email: before.email },
    });
  }

  static async transferOwnership(
    organizationId: string,
    actorId: string,
    targetUserId: string,
  ) {
    const [actor, target] = await Promise.all([
      prisma.user.findFirst({
        where: {
          id: actorId,
          organizationId,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: {
          id: targetUserId,
          organizationId,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      }),
    ]);

    if (!actor) throw new NotFoundError("Actor");
    if (!target) throw new NotFoundError("Target user");

    await prisma.$transaction(async (tx) => {
      const ownerUserId = await this.getOrganizationOwnerId(tx, organizationId);
      if (ownerUserId !== actorId) {
        throw new ConflictError("Only the current owner can transfer ownership");
      }
      if (actorId === targetUserId) {
        throw new ConflictError("Target user is already the owner");
      }

      await tx.organization.update({
        where: { id: organizationId },
        data: { ownerUserId: targetUserId },
      });

      // Demote previous owner: drop Owner role assignments, ensure they keep access.
      const ownerRole = await tx.role.findFirst({
        where: {
          organizationId,
          name: SYSTEM_ROLES.OWNER,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (ownerRole) {
        await tx.userBranchRole.deleteMany({
          where: { userId: actorId, roleId: ownerRole.id },
        });
      }

      const remainingAssignments = await tx.userBranchRole.count({
        where: { userId: actorId },
      });
      if (remainingAssignments === 0) {
        const managerRole = await tx.role.findFirst({
          where: {
            organizationId,
            name: SYSTEM_ROLES.MANAGER,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!managerRole) {
          throw new ConflictError("Manager role is required to demote the previous owner");
        }

        const defaultBranch = await tx.branch.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            isActive: true,
          },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          select: { id: true },
        });
        if (!defaultBranch) {
          throw new ConflictError("No active branch available for previous owner assignment");
        }

        await tx.userBranchRole.create({
          data: {
            userId: actorId,
            branchId: defaultBranch.id,
            roleId: managerRole.id,
          },
        });
      }
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "ownership.transferred",
      entityType: "Organization",
      entityId: organizationId,
      after: { ownerUserId: targetUserId },
    });
  }
}

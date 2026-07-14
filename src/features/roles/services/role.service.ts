import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { assertSystemRoleRenameAllowed } from "@/lib/permissions/role-guards";
import {
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSION_MAP,
  SYSTEM_ROLES,
  type SystemRoleName,
} from "@/lib/permissions/roles";
import { AuditService } from "@/lib/services/audit-service";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export class RoleService {
  static async list(organizationId: string) {
    return prisma.role.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { userBranchRoles: true } },
      },
    });
  }

  static async getById(id: string, organizationId: string) {
    const role = await prisma.role.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
    if (!role) throw new NotFoundError("Role");
    return role;
  }

  /**
   * Upsert system roles and replace their permissions from ROLE_PERMISSION_MAP.
   * Used by seed / provisioning / explicit “reset to defaults”.
   */
  static async syncSystemRolePermissions(
    organizationId: string,
    options?: { tx?: Tx; actorId?: string },
  ) {
    const db = options?.tx ?? prisma;
    const allPermissions = await db.permission.findMany({
      select: { id: true, code: true },
    });
    const permissionMap = new Map(allPermissions.map((p) => [p.code, p.id]));

    for (const roleName of Object.values(SYSTEM_ROLES)) {
      const description = ROLE_DESCRIPTIONS[roleName];
      const role = await db.role.upsert({
        where: {
          organizationId_name: { organizationId, name: roleName },
        },
        update: { description, isSystem: true, deletedAt: null },
        create: {
          organizationId,
          name: roleName,
          description,
          isSystem: true,
        },
      });

      await db.rolePermission.deleteMany({ where: { roleId: role.id } });

      const codes = ROLE_PERMISSION_MAP[roleName as SystemRoleName];
      for (const code of codes) {
        const permissionId = permissionMap.get(code);
        if (!permissionId) continue;
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId },
        });
      }
    }

    if (options?.actorId && !options.tx) {
      await AuditService.log({
        organizationId,
        userId: options.actorId,
        action: "roles.system_synced",
        entityType: "Role",
        after: { roles: Object.values(SYSTEM_ROLES) },
      });
    }
  }

  static async create(
    data: {
      organizationId: string;
      name: string;
      description?: string;
      permissionIds: string[];
    },
    actorId: string,
  ) {
    const existing = await prisma.role.findFirst({
      where: {
        organizationId: data.organizationId,
        name: data.name,
        deletedAt: null,
      },
    });
    if (existing) throw new ConflictError("Role name already exists");

    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          organizationId: data.organizationId,
          name: data.name,
          description: data.description,
          isSystem: false,
        },
      });

      for (const permissionId of data.permissionIds) {
        await tx.rolePermission.create({
          data: { roleId: created.id, permissionId },
        });
      }

      return created;
    });

    await AuditService.log({
      organizationId: data.organizationId,
      userId: actorId,
      action: "role.created",
      entityType: "Role",
      entityId: role.id,
      after: { name: role.name },
    });

    return this.getById(role.id, data.organizationId);
  }

  static async update(
    id: string,
    organizationId: string,
    data: {
      name?: string;
      description?: string;
      permissionIds?: string[];
    },
    actorId: string,
  ) {
    const role = await this.getById(id, organizationId);
    assertSystemRoleRenameAllowed(role.isSystem, role.name, data.name);

    const beforePermissionIds = role.rolePermissions.map(
      (rp) => rp.permissionId,
    );

    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          ...(role.isSystem ? {} : data.name != null ? { name: data.name } : {}),
          description: data.description,
        },
      });

      if (data.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        for (const permissionId of data.permissionIds) {
          await tx.rolePermission.create({
            data: { roleId: id, permissionId },
          });
        }
      }
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "role.updated",
      entityType: "Role",
      entityId: id,
      before: {
        name: role.name,
        description: role.description,
        permissionIds: beforePermissionIds,
      },
      after: {
        name: role.isSystem ? role.name : (data.name ?? role.name),
        description: data.description ?? role.description,
        permissionIds: data.permissionIds ?? beforePermissionIds,
      },
    });

    return this.getById(id, organizationId);
  }

  static async softDelete(id: string, organizationId: string, actorId: string) {
    const role = await this.getById(id, organizationId);
    if (role.isSystem) throw new ConflictError("Cannot delete system roles");

    const userCount = await prisma.userBranchRole.count({
      where: { roleId: id },
    });
    if (userCount > 0) {
      throw new ConflictError("Role is assigned to users");
    }

    await prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "role.deleted",
      entityType: "Role",
      entityId: id,
      before: { name: role.name },
    });
  }

  static async listPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { action: "asc" }],
    });
  }
}

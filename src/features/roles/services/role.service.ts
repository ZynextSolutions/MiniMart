import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { assertSystemRolePermissionsEditable } from "@/lib/permissions/role-guards";
import { AuditService } from "@/lib/services/audit-service";

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
    if (role.isSystem && data.name && data.name !== role.name) {
      throw new ConflictError("Cannot rename system roles");
    }
    assertSystemRolePermissionsEditable(role.isSystem, data.permissionIds);

    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          name: data.name,
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
      after: { name: data.name ?? role.name },
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

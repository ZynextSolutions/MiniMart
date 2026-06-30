import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";

export class WarehouseService {
  static async list(organizationId: string, branchId?: string) {
    return prisma.warehouse.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        branch: { select: { id: true, name: true, code: true } },
        _count: { select: { stockLevels: true } },
      },
    });
  }

  static async create(
    data: {
      organizationId: string;
      branchId: string;
      code: string;
      name: string;
      address?: string;
      isDefault?: boolean;
    },
    actorId: string,
  ) {
    const existing = await prisma.warehouse.findFirst({
      where: { organizationId: data.organizationId, code: data.code, deletedAt: null },
    });
    if (existing) throw new ConflictError("Warehouse code already exists");

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.warehouse.updateMany({
          where: { branchId: data.branchId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const warehouse = await tx.warehouse.create({
        data: { ...data, isActive: true },
      });

      await AuditService.log({
        organizationId: data.organizationId,
        userId: actorId,
        action: "warehouse.created",
        entityType: "Warehouse",
        entityId: warehouse.id,
        after: { code: warehouse.code, name: warehouse.name },
      });

      return warehouse;
    });
  }

  static async update(
    id: string,
    organizationId: string,
    data: Partial<{
      name: string;
      address: string;
      isDefault: boolean;
      isActive: boolean;
    }>,
    actorId: string,
  ) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!warehouse) throw new NotFoundError("Warehouse");

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.warehouse.updateMany({
          where: { branchId: warehouse.branchId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      const updated = await tx.warehouse.update({ where: { id }, data });

      await AuditService.log({
        organizationId,
        userId: actorId,
        action: "warehouse.updated",
        entityType: "Warehouse",
        entityId: id,
        after: { name: updated.name },
      });

      return updated;
    });
  }

  static async softDelete(id: string, organizationId: string, actorId: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!warehouse) throw new NotFoundError("Warehouse");
    if (warehouse.isDefault) throw new ConflictError("Cannot delete default warehouse");

    const stock = await prisma.stockLevel.count({
      where: { warehouseId: id, quantity: { gt: 0 } },
    });
    if (stock > 0) throw new ConflictError("Warehouse has stock");

    await prisma.warehouse.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "warehouse.deleted",
      entityType: "Warehouse",
      entityId: id,
    });
  }
}

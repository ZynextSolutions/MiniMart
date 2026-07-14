import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import { ensureStockLevelsForVariants } from "@/lib/services/stock-level-provisioning";
import { PlanLimitsService } from "@/platform/subscriptions/plan-limits.service";

export class BranchService {
  static async list(organizationId: string) {
    return prisma.branch.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { warehouses: true, cashRegisters: true } },
      },
    });
  }

  static async create(
    data: {
      organizationId: string;
      code: string;
      name: string;
      address?: string;
      phone?: string;
      email?: string;
      isDefault?: boolean;
    },
    actorId: string,
  ) {
    const existing = await prisma.branch.findFirst({
      where: { organizationId: data.organizationId, code: data.code, deletedAt: null },
    });
    if (existing) throw new ConflictError("Branch code already exists");

    await PlanLimitsService.checkLimit(data.organizationId, "maxBranches");

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.branch.updateMany({
          where: { organizationId: data.organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const branch = await tx.branch.create({
        data: {
          ...data,
          isActive: true,
          createdById: actorId,
        },
      });

      const existingWarehouseCodes = await tx.warehouse.findMany({
        where: { organizationId: data.organizationId, code: { startsWith: "WH-" } },
        select: { code: true },
      });
      const usedNumbers = new Set<number>();
      for (const item of existingWarehouseCodes) {
        const match = /^WH-(\d+)$/.exec(item.code);
        if (!match) continue;
        usedNumbers.add(Number(match[1]));
      }
      let nextWarehouseNumber = 1;
      while (usedNumbers.has(nextWarehouseNumber)) {
        nextWarehouseNumber += 1;
      }
      const defaultWarehouseCode = `WH-${String(nextWarehouseNumber).padStart(2, "0")}`;

      const warehouse = await tx.warehouse.create({
        data: {
          organizationId: data.organizationId,
          branchId: branch.id,
          code: defaultWarehouseCode,
          name: `${branch.name} Warehouse`,
          isDefault: true,
          isActive: true,
        },
      });

      const variants = await tx.productVariant.findMany({
        where: {
          deletedAt: null,
          product: { organizationId: data.organizationId, deletedAt: null },
        },
        select: { id: true },
      });
      await ensureStockLevelsForVariants(
        data.organizationId,
        variants.map((v) => v.id),
        { warehouseIds: [warehouse.id], tx },
      );

      await tx.cashRegister.create({
        data: {
          branchId: branch.id,
          code: "REG-01",
          name: "Register 1",
          isActive: true,
        },
      });

      await AuditService.log({
        organizationId: data.organizationId,
        userId: actorId,
        action: "branch.created",
        entityType: "Branch",
        entityId: branch.id,
        after: { code: branch.code, name: branch.name },
      });

      return branch;
    });
  }

  static async update(
    id: string,
    organizationId: string,
    data: Partial<{
      name: string;
      address: string;
      phone: string;
      email: string;
      isDefault: boolean;
      isActive: boolean;
    }>,
    actorId: string,
  ) {
    const branch = await prisma.branch.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!branch) throw new NotFoundError("Branch");

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.branch.updateMany({
          where: { organizationId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      const updated = await tx.branch.update({
        where: { id },
        data: { ...data, updatedById: actorId },
      });

      await AuditService.log({
        organizationId,
        userId: actorId,
        action: "branch.updated",
        entityType: "Branch",
        entityId: id,
        after: { name: updated.name },
      });

      return updated;
    });
  }

  static async softDelete(id: string, organizationId: string, actorId: string) {
    const branch = await prisma.branch.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!branch) throw new NotFoundError("Branch");
    if (branch.isDefault) throw new ConflictError("Cannot delete default branch");

    await prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "branch.deleted",
      entityType: "Branch",
      entityId: id,
    });
  }
}

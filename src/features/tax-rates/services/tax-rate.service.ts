import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class TaxRateService {
  static async list(organizationId: string) {
    return prisma.taxRate.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
  }

  static async create(
    data: {
      organizationId: string;
      name: string;
      rate: number;
      isDefault?: boolean;
    },
    actorId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.taxRate.updateMany({
          where: { organizationId: data.organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const taxRate = await tx.taxRate.create({
        data: {
          organizationId: data.organizationId,
          name: data.name,
          rate: new Decimal(data.rate),
          isDefault: data.isDefault ?? false,
          isActive: true,
        },
      });

      await AuditService.log({
        organizationId: data.organizationId,
        userId: actorId,
        action: "tax_rate.created",
        entityType: "TaxRate",
        entityId: taxRate.id,
        after: { name: taxRate.name, rate: data.rate },
      });

      return taxRate;
    });
  }

  static async update(
    id: string,
    organizationId: string,
    data: { name?: string; rate?: number; isDefault?: boolean; isActive?: boolean },
    actorId: string,
  ) {
    const taxRate = await prisma.taxRate.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!taxRate) throw new NotFoundError("Tax rate");

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.taxRate.updateMany({
          where: { organizationId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      const updated = await tx.taxRate.update({
        where: { id },
        data: {
          name: data.name,
          rate: data.rate !== undefined ? new Decimal(data.rate) : undefined,
          isDefault: data.isDefault,
          isActive: data.isActive,
        },
      });

      await AuditService.log({
        organizationId,
        userId: actorId,
        action: "tax_rate.updated",
        entityType: "TaxRate",
        entityId: id,
        after: { name: updated.name },
      });

      return updated;
    });
  }

  static async softDelete(id: string, organizationId: string, actorId: string) {
    const taxRate = await prisma.taxRate.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!taxRate) throw new NotFoundError("Tax rate");

    const inUse = await prisma.product.count({
      where: { taxRateId: id, organizationId, deletedAt: null },
    });
    if (inUse > 0) throw new ConflictError("Tax rate is used by products");

    await prisma.taxRate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, isDefault: false },
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "tax_rate.deleted",
      entityType: "TaxRate",
      entityId: id,
    });
  }
}

import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import type { Prisma } from "@prisma/client";

export class UnitService {
  static async list(organizationId: string, search?: string) {
    const where: Prisma.UnitWhereInput = {
      organizationId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { abbreviation: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return prisma.unit.findMany({
      where,
      orderBy: { name: "asc" },
    });
  }

  static async create(
    data: { organizationId: string; name: string; abbreviation: string },
    actorId: string,
  ) {
    const existing = await prisma.unit.findFirst({
      where: {
        organizationId: data.organizationId,
        abbreviation: data.abbreviation,
        deletedAt: null,
      },
    });
    if (existing) throw new ConflictError("Abbreviation already exists");

    const unit = await prisma.unit.create({
      data: { ...data, isActive: true },
    });

    await AuditService.log({
      organizationId: data.organizationId,
      userId: actorId,
      action: "unit.created",
      entityType: "Unit",
      entityId: unit.id,
      after: { name: unit.name, abbreviation: unit.abbreviation },
    });
    return unit;
  }

  static async update(
    id: string,
    organizationId: string,
    data: { name?: string; abbreviation?: string; isActive?: boolean },
    actorId: string,
  ) {
    const unit = await prisma.unit.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!unit) throw new NotFoundError("Unit");

    if (data.abbreviation && data.abbreviation !== unit.abbreviation) {
      const dup = await prisma.unit.findFirst({
        where: {
          organizationId,
          abbreviation: data.abbreviation,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (dup) throw new ConflictError("Abbreviation already exists");
    }

    const updated = await prisma.unit.update({ where: { id }, data });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "unit.updated",
      entityType: "Unit",
      entityId: id,
      after: { name: updated.name },
    });
    return updated;
  }

  static async softDelete(id: string, organizationId: string, actorId: string) {
    const unit = await prisma.unit.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!unit) throw new NotFoundError("Unit");

    const inUse = await prisma.product.count({
      where: { unitId: id, organizationId, deletedAt: null },
    });
    if (inUse > 0) throw new ConflictError("Unit is used by products");

    await prisma.unit.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "unit.deleted",
      entityType: "Unit",
      entityId: id,
    });
  }
}

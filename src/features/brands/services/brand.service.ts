import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import { uniqueSlug } from "@/lib/utils/slug";
import type { Prisma } from "@prisma/client";

export class BrandService {
  static async list(organizationId: string, search?: string) {
    const where: Prisma.ProductBrandWhereInput = {
      organizationId,
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    return prisma.productBrand.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
  }

  static async create(
    data: { organizationId: string; name: string; logoUrl?: string },
    actorId: string,
  ) {
    const slug = await uniqueSlug(data.name, async (s) => {
      const found = await prisma.productBrand.findFirst({
        where: { organizationId: data.organizationId, slug: s, deletedAt: null },
      });
      return !!found;
    });

    const brand = await prisma.productBrand.create({
      data: { ...data, slug, isActive: true },
    });

    await AuditService.log({
      organizationId: data.organizationId,
      userId: actorId,
      action: "brand.created",
      entityType: "ProductBrand",
      entityId: brand.id,
      after: { name: brand.name },
    });
    return brand;
  }

  static async update(
    id: string,
    organizationId: string,
    data: { name?: string; logoUrl?: string; isActive?: boolean },
    actorId: string,
  ) {
    const brand = await prisma.productBrand.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!brand) throw new NotFoundError("Brand");

    const updated = await prisma.productBrand.update({ where: { id }, data });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "brand.updated",
      entityType: "ProductBrand",
      entityId: id,
      after: { name: updated.name },
    });
    return updated;
  }

  static async softDelete(id: string, organizationId: string, actorId: string) {
    const brand = await prisma.productBrand.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!brand) throw new NotFoundError("Brand");

    await prisma.productBrand.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "brand.deleted",
      entityType: "ProductBrand",
      entityId: id,
    });
  }
}

import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import { uniqueSlug } from "@/lib/utils/slug";
import type { Prisma } from "@prisma/client";

export class CategoryService {
  static async list(organizationId: string) {
    return prisma.productCategory.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { products: true, children: true } },
      },
    });
  }

  static async listFlat(organizationId: string) {
    return prisma.productCategory.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true },
    });
  }

  static async create(
    data: {
      organizationId: string;
      name: string;
      parentId?: string;
      description?: string;
      sortOrder?: number;
    },
    actorId: string,
  ) {
    const slug = await uniqueSlug(data.name, async (s) => {
      const found = await prisma.productCategory.findFirst({
        where: { organizationId: data.organizationId, slug: s, deletedAt: null },
      });
      return !!found;
    });

    const category = await prisma.productCategory.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        slug,
        parentId: data.parentId || null,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
        isActive: true,
        createdById: actorId,
      },
    });

    await AuditService.log({
      organizationId: data.organizationId,
      userId: actorId,
      action: "category.created",
      entityType: "ProductCategory",
      entityId: category.id,
      after: { name: category.name },
    });
    return category;
  }

  static async update(
    id: string,
    organizationId: string,
    data: {
      name?: string;
      parentId?: string | null;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
    actorId: string,
  ) {
    const category = await prisma.productCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!category) throw new NotFoundError("Category");

    if (data.parentId === id) {
      throw new ConflictError("Category cannot be its own parent");
    }

    const updated = await prisma.productCategory.update({
      where: { id },
      data: { ...data, updatedById: actorId },
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "category.updated",
      entityType: "ProductCategory",
      entityId: id,
      after: { name: updated.name },
    });
    return updated;
  }

  static async softDelete(id: string, organizationId: string, actorId: string) {
    const category = await prisma.productCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!category) throw new NotFoundError("Category");

    const children = await prisma.productCategory.count({
      where: { parentId: id, organizationId, deletedAt: null },
    });
    if (children > 0) throw new ConflictError("Category has subcategories");

    const products = await prisma.product.count({
      where: { categoryId: id, organizationId, deletedAt: null },
    });
    if (products > 0) throw new ConflictError("Category has products");

    await prisma.productCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "category.deleted",
      entityType: "ProductCategory",
      entityId: id,
    });
  }
}

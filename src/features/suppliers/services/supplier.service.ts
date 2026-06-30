import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

async function nextCode(organizationId: string, prefix: string, table: "supplier" | "customer") {
  const count =
    table === "supplier"
      ? await prisma.supplier.count({ where: { organizationId } })
      : await prisma.customer.count({ where: { organizationId } });
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

export class SupplierService {
  static async list(organizationId: string, params?: { search?: string; page?: number; pageSize?: number }) {
    const { search, page = 1, pageSize = 20 } = params ?? {};
    const where: Prisma.SupplierWhereInput = {
      organizationId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.supplier.count({ where }),
    ]);

    return { suppliers, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async getById(id: string, organizationId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundError("Supplier");
    return supplier;
  }

  static async create(
    data: {
      organizationId: string;
      name: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
      taxId?: string;
      paymentTerms?: number;
      creditLimit?: number;
    },
    actorId: string,
  ) {
    const code = await nextCode(data.organizationId, "SUP", "supplier");
    const supplier = await prisma.supplier.create({
      data: {
        ...data,
        code,
        creditLimit: new Decimal(data.creditLimit ?? 0),
        paymentTerms: data.paymentTerms ?? 30,
        isActive: true,
        createdById: actorId,
      },
    });

    await AuditService.log({
      organizationId: data.organizationId,
      userId: actorId,
      action: "supplier.created",
      entityType: "Supplier",
      entityId: supplier.id,
      after: { code: supplier.code, name: supplier.name },
    });
    return supplier;
  }

  static async update(
    id: string,
    organizationId: string,
    data: Partial<{
      name: string;
      contactPerson: string;
      email: string;
      phone: string;
      address: string;
      taxId: string;
      paymentTerms: number;
      creditLimit: number;
      isActive: boolean;
    }>,
    actorId: string,
  ) {
    await this.getById(id, organizationId);
    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...data,
        creditLimit: data.creditLimit !== undefined ? new Decimal(data.creditLimit) : undefined,
      },
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "supplier.updated",
      entityType: "Supplier",
      entityId: id,
      after: { name: updated.name },
    });
    return updated;
  }

  static async softDelete(id: string, organizationId: string, actorId: string) {
    await this.getById(id, organizationId);
    await prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "supplier.deleted",
      entityType: "Supplier",
      entityId: id,
    });
  }
}

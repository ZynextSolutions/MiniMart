import { prisma } from "@/infrastructure/database/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

async function nextCustomerCode(organizationId: string) {
  const count = await prisma.customer.count({ where: { organizationId } });
  return `CUS-${String(count + 1).padStart(5, "0")}`;
}

export class CustomerService {
  static async list(organizationId: string, params?: { search?: string; page?: number; pageSize?: number }) {
    const { search, page = 1, pageSize = 20 } = params ?? {};
    const where: Prisma.CustomerWhereInput = {
      organizationId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.customer.count({ where }),
    ]);

    return { customers, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async getById(id: string, organizationId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!customer) throw new NotFoundError("Customer");
    return customer;
  }

  static async create(
    data: {
      organizationId: string;
      name: string;
      email?: string;
      phone?: string;
      address?: string;
      membershipTier?: string;
      creditLimit?: number;
    },
    actorId: string,
  ) {
    const code = await nextCustomerCode(data.organizationId);
    const customer = await prisma.customer.create({
      data: {
        ...data,
        code,
        creditLimit: new Decimal(data.creditLimit ?? 0),
        loyaltyPoints: new Decimal(0),
        isActive: true,
        createdById: actorId,
      },
    });

    await AuditService.log({
      organizationId: data.organizationId,
      userId: actorId,
      action: "customer.created",
      entityType: "Customer",
      entityId: customer.id,
      after: { code: customer.code, name: customer.name },
    });
    return customer;
  }

  static async update(
    id: string,
    organizationId: string,
    data: Partial<{
      name: string;
      email: string;
      phone: string;
      address: string;
      membershipTier: string;
      creditLimit: number;
      isActive: boolean;
    }>,
    actorId: string,
  ) {
    await this.getById(id, organizationId);
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...data,
        creditLimit: data.creditLimit !== undefined ? new Decimal(data.creditLimit) : undefined,
      },
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "customer.updated",
      entityType: "Customer",
      entityId: id,
      after: { name: updated.name },
    });
    return updated;
  }

  static async softDelete(id: string, organizationId: string, actorId: string) {
    await this.getById(id, organizationId);
    await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "customer.deleted",
      entityType: "Customer",
      entityId: id,
    });
  }
}

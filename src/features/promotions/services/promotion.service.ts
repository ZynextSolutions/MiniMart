import { prisma } from "@/infrastructure/database/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { ConflictError } from "@/lib/errors/app-error";

export class PromotionService {
  static async list(organizationId: string) {
    return prisma.promotion.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(
    organizationId: string,
    data: {
      name: string;
      code?: string;
      discountType: string;
      discountValue: number;
      minPurchase?: number;
      startDate: Date;
      endDate: Date;
      isActive?: boolean;
    },
  ) {
    return prisma.promotion.create({
      data: {
        organizationId,
        name: data.name,
        code: data.code,
        discountType: data.discountType,
        discountValue: new Decimal(data.discountValue),
        minPurchase: data.minPurchase ? new Decimal(data.minPurchase) : null,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive ?? true,
      },
    });
  }
}

export class CouponAdminService {
  static async list(organizationId: string) {
    return prisma.coupon.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(
    organizationId: string,
    data: {
      code: string;
      discountType: string;
      discountValue: number;
      maxUses?: number;
      startDate: Date;
      endDate: Date;
      isActive?: boolean;
    },
  ) {
    const existing = await prisma.coupon.findFirst({
      where: { organizationId, code: data.code.toUpperCase() },
    });
    if (existing) throw new ConflictError("Coupon code already exists");

    return prisma.coupon.create({
      data: {
        organizationId,
        code: data.code.toUpperCase(),
        discountType: data.discountType,
        discountValue: new Decimal(data.discountValue),
        maxUses: data.maxUses,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive ?? true,
      },
    });
  }
}

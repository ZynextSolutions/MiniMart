import { prisma } from "@/infrastructure/database/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { ConflictError } from "@/lib/errors/app-error";
import crypto from "crypto";

export class GiftCardService {
  static async list(organizationId: string) {
    return prisma.giftCard.findMany({
      where: {
        customer: { organizationId },
      },
      include: { customer: { select: { name: true, code: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  static async issue(
    organizationId: string,
    data: {
      customerId: string;
      initialBalance: number;
      expiresAt?: Date;
    },
  ) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId, deletedAt: null },
    });
    if (!customer) throw new ConflictError("Customer not found");

    const code = `GC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    return prisma.giftCard.create({
      data: {
        customerId: data.customerId,
        code,
        balance: new Decimal(data.initialBalance),
        issuedAt: new Date(),
        expiresAt: data.expiresAt,
        isActive: true,
      },
    });
  }
}

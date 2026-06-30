import { prisma } from "@/infrastructure/database/prisma";

export class BarcodeQueryService {
  static async listProductsForLabels(organizationId: string, search?: string) {
    return prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
                { barcodes: { some: { code: { contains: search } } } },
              ],
            }
          : {}),
      },
      take: 50,
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        sellingPrice: true,
        barcodes: { where: { isPrimary: true }, take: 1, select: { code: true, type: true } },
        variants: {
          take: 1,
          select: {
            barcodes: { where: { isPrimary: true }, take: 1, select: { code: true, type: true } },
          },
        },
      },
    });
  }
}

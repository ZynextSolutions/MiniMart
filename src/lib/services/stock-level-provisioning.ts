import { prisma } from "@/infrastructure/database/prisma";
import { ZERO } from "@/lib/utils/decimal";
import type { Prisma } from "@prisma/client";

const CREATE_CHUNK = 500;

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Idempotently create zero stock rows for variants × warehouses.
 * Uses createMany + skipDuplicates for performance.
 */
export async function ensureStockLevelsForVariants(
  organizationId: string,
  variantIds: string[],
  options?: {
    warehouseIds?: string[];
    tx?: Prisma.TransactionClient;
  },
): Promise<number> {
  const uniqueVariantIds = [...new Set(variantIds)].filter(Boolean);
  if (uniqueVariantIds.length === 0) return 0;

  const db: Db = options?.tx ?? prisma;
  const warehouses = await db.warehouse.findMany({
    where: {
      organizationId,
      deletedAt: null,
      isActive: true,
      ...(options?.warehouseIds?.length
        ? { id: { in: options.warehouseIds } }
        : {}),
    },
    select: { id: true },
  });
  if (warehouses.length === 0) return 0;

  const rows = warehouses.flatMap((warehouse) =>
    uniqueVariantIds.map((variantId) => ({
      warehouseId: warehouse.id,
      variantId,
      quantity: ZERO,
      avgCost: ZERO,
    })),
  );

  let created = 0;
  for (let i = 0; i < rows.length; i += CREATE_CHUNK) {
    const chunk = rows.slice(i, i + CREATE_CHUNK);
    const result = await db.stockLevel.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    created += result.count;
  }
  return created;
}

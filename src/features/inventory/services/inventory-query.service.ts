import { prisma } from "@/infrastructure/database/prisma";
import type { MovementType, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { mul, toDecimal } from "@/lib/utils/decimal";

export interface StockLevelRow {
  id: string;
  quantity: Decimal;
  avgCost: Decimal;
  reservedQty: Decimal;
  costingMethod: string;
  warehouse: { id: string; name: string; code: string };
  variant: {
    id: string;
    sku: string;
    name: string;
    product: {
      id: string;
      name: string;
      sku: string;
      reorderLevel: Decimal;
      minStock: Decimal;
      unit: { abbreviation: string };
    };
  };
}

export interface ValuationRow {
  variantId: string;
  productName: string;
  sku: string;
  warehouseName: string;
  quantity: Decimal;
  avgCost: Decimal;
  totalValue: Decimal;
}

export interface LedgerRow {
  id: string;
  movementType: MovementType;
  quantity: number;
  balanceAfter: number;
  unitCost: number;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  variant: { sku: string; name: string; product: { name: string } };
}

export interface MovementRow {
  id: string;
  movementNumber: string;
  movementType: MovementType;
  movementDate: Date;
  notes: string | null;
  status: string;
  warehouse: { name: string; code: string };
  lines: {
    quantity: Decimal;
    unitCost: Decimal;
    totalCost: Decimal;
    variant: { sku: string; name: string; product: { name: string } };
  }[];
}

export class InventoryQueryService {
  static async listStockLevels(params: {
    organizationId: string;
    warehouseId?: string;
    search?: string;
    lowStockOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const { organizationId, warehouseId, search, lowStockOnly, page = 1, pageSize = 20 } = params;

    const where: Prisma.StockLevelWhereInput = {
      warehouse: { organizationId, deletedAt: null },
      ...(warehouseId ? { warehouseId } : {}),
      ...(search
        ? {
            variant: {
              OR: [
                { sku: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                { product: { name: { contains: search, mode: "insensitive" } } },
              ],
            },
          }
        : {}),
    };

    const [levels, total] = await Promise.all([
      prisma.stockLevel.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  reorderLevel: true,
                  minStock: true,
                  unit: { select: { abbreviation: true } },
                },
              },
            },
          },
        },
      }),
      prisma.stockLevel.count({ where }),
    ]);

    const filtered = lowStockOnly
      ? levels.filter(
          (l) =>
            l.quantity.lte(l.variant.product.reorderLevel) &&
            l.variant.product.reorderLevel.gt(0),
        )
      : levels;

    return {
      levels: filtered as StockLevelRow[],
      total: lowStockOnly ? filtered.length : total,
      page,
      totalPages: Math.ceil((lowStockOnly ? filtered.length : total) / pageSize),
    };
  }

  static async getValuation(organizationId: string, warehouseId?: string): Promise<ValuationRow[]> {
    const levels = await prisma.stockLevel.findMany({
      where: {
        warehouse: { organizationId, deletedAt: null },
        ...(warehouseId ? { warehouseId } : {}),
        quantity: { gt: 0 },
      },
      include: {
        warehouse: { select: { name: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { warehouse: { name: "asc" } },
    });

    return levels.map((l) => ({
      variantId: l.variantId,
      productName: l.variant.product.name,
      sku: l.variant.sku,
      warehouseName: l.warehouse.name,
      quantity: l.quantity,
      avgCost: l.avgCost,
      totalValue: mul(l.quantity, l.avgCost),
    }));
  }

  static async getLedger(params: {
    organizationId: string;
    warehouseId?: string;
    variantId?: string;
    from?: Date;
    to?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const { organizationId, warehouseId, variantId, from, to, page = 1, pageSize = 50 } = params;

    let warehouseIds: string[] | undefined;
    if (!warehouseId) {
      const warehouses = await prisma.warehouse.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true },
      });
      warehouseIds = warehouses.map((w) => w.id);
    }

    const where: Prisma.InventoryLedgerWhereInput = {
      ...(warehouseId ? { warehouseId } : { warehouseId: { in: warehouseIds } }),
      ...(variantId ? { variantId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [entries, total] = await Promise.all([
      prisma.inventoryLedger.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.inventoryLedger.count({ where }),
    ]);

    const variantIds = [...new Set(entries.map((e) => e.variantId))];
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        sku: true,
        name: true,
        product: { select: { name: true } },
      },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const enriched: LedgerRow[] = entries.map((e) => ({
      id: e.id,
      movementType: e.movementType,
      quantity: Number(e.quantity),
      balanceAfter: Number(e.balanceAfter),
      unitCost: Number(e.unitCost),
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      createdAt: e.createdAt.toISOString(),
      variant: variantMap.get(e.variantId) ?? {
        sku: "",
        name: "",
        product: { name: "Unknown" },
      },
    }));

    return {
      entries: enriched,
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async listMovements(params: {
    organizationId: string;
    movementType?: MovementType | MovementType[];
    warehouseId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { organizationId, movementType, warehouseId, page = 1, pageSize = 20 } = params;

    const where: Prisma.InventoryMovementWhereInput = {
      organizationId,
      ...(warehouseId ? { warehouseId } : {}),
      ...(movementType
        ? Array.isArray(movementType)
          ? { movementType: { in: movementType } }
          : { movementType }
        : {}),
    };

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { movementDate: "desc" },
        include: {
          warehouse: { select: { name: true, code: true } },
          lines: {
            include: {
              variant: {
                select: { sku: true, name: true, product: { select: { name: true } } },
              },
            },
          },
        },
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return {
      movements: movements as MovementRow[],
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async listStockCounts(organizationId: string, warehouseId?: string) {
    return prisma.stockCount.findMany({
      where: {
        warehouse: { organizationId, deletedAt: null },
        ...(warehouseId ? { warehouseId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        warehouse: { select: { name: true, code: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  static async getStockCount(id: string, organizationId: string) {
    const stockCount = await prisma.stockCount.findFirst({
      where: {
        id,
        warehouse: { organizationId },
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        lines: { orderBy: { variantId: "asc" } },
      },
    });

    if (!stockCount) return null;

    const variantIds = stockCount.lines.map((l) => l.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        sku: true,
        name: true,
        product: { select: { name: true, unit: { select: { abbreviation: true } } } },
      },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    return {
      ...stockCount,
      lines: stockCount.lines.map((line) => ({
        ...line,
        variant: variantMap.get(line.variantId) ?? {
          sku: "",
          name: "",
          product: { name: "Unknown", unit: { abbreviation: "" } },
        },
      })),
    };
  }

  static async searchVariants(organizationId: string, query: string, limit = 20) {
    if (!query.trim()) return [];

    return prisma.productVariant.findMany({
      where: {
        deletedAt: null,
        product: { organizationId, deletedAt: null, isActive: true },
        OR: [
          { sku: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
          { product: { name: { contains: query, mode: "insensitive" } } },
          { barcodes: { some: { code: { contains: query } } } },
        ],
      },
      take: limit,
      select: {
        id: true,
        sku: true,
        name: true,
        costPrice: true,
        product: {
          select: {
            name: true,
            trackBatch: true,
            trackExpiry: true,
            unit: { select: { abbreviation: true } },
          },
        },
      },
    });
  }

  static async getVariantStock(variantId: string, warehouseId: string) {
    return prisma.stockLevel.findUnique({
      where: { warehouseId_variantId: { warehouseId, variantId } },
    });
  }

  static async getSummary(organizationId: string) {
    const levels = await prisma.stockLevel.findMany({
      where: { warehouse: { organizationId, deletedAt: null } },
      include: {
        variant: { select: { product: { select: { reorderLevel: true } } } },
      },
    });

    let totalValue = toDecimal(0);
    let lowStockCount = 0;
    let totalSkus = levels.length;
    let inStockSkus = 0;

    for (const l of levels) {
      totalValue = totalValue.add(mul(l.quantity, l.avgCost));
      if (l.quantity.gt(0)) inStockSkus++;
      if (
        l.quantity.lte(l.variant.product.reorderLevel) &&
        l.variant.product.reorderLevel.gt(0)
      ) {
        lowStockCount++;
      }
    }

    return { totalValue, lowStockCount, totalSkus, inStockSkus };
  }
}

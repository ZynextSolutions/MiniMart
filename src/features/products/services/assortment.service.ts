import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/infrastructure/database/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors/app-error";

export type AssortmentMode = "open" | "restricted";

export interface AssortmentItem {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  variantName: string;
  baseSellingPrice: number;
  isActive: boolean;
  sellingPriceOverride: number | null;
}

export interface AssortmentCatalogue {
  mode: AssortmentMode;
  activeCount: number;
  totalCount: number;
  items: AssortmentItem[];
}

export class AssortmentService {
  static async isRestricted(
    organizationId: string,
    branchId: string,
  ): Promise<boolean> {
    const count = await prisma.branchProduct.count({
      where: { organizationId, branchId },
    });
    return count > 0;
  }

  /**
   * Hybrid rule: null = full org catalogue; otherwise only listed active variant IDs.
   */
  static async getActiveVariantIds(
    organizationId: string,
    branchId: string,
  ): Promise<Set<string> | null> {
    const rows = await prisma.branchProduct.findMany({
      where: { organizationId, branchId },
      select: { variantId: true, isActive: true },
    });
    if (rows.length === 0) return null;
    return new Set(rows.filter((r) => r.isActive).map((r) => r.variantId));
  }

  static async getPriceOverrides(
    organizationId: string,
    branchId: string,
    variantIds: string[],
  ): Promise<Map<string, number>> {
    if (variantIds.length === 0) return new Map();
    const rows = await prisma.branchProduct.findMany({
      where: {
        organizationId,
        branchId,
        variantId: { in: variantIds },
        sellingPrice: { not: null },
      },
      select: { variantId: true, sellingPrice: true },
    });
    return new Map(
      rows
        .filter((r) => r.sellingPrice != null)
        .map((r) => [r.variantId, Number(r.sellingPrice)]),
    );
  }

  /**
   * Returns sellability + effective unit price for each variant at a branch.
   */
  static async resolveVariantsForSale(
    organizationId: string,
    branchId: string,
    variantIds: string[],
  ): Promise<
    Map<string, { allowed: boolean; sellingPrice: number | null }>
  > {
    const uniqueIds = [...new Set(variantIds)];
    const result = new Map<
      string,
      { allowed: boolean; sellingPrice: number | null }
    >();

    if (uniqueIds.length === 0) return result;

    const [activeIds, overrides] = await Promise.all([
      AssortmentService.getActiveVariantIds(organizationId, branchId),
      AssortmentService.getPriceOverrides(organizationId, branchId, uniqueIds),
    ]);

    for (const id of uniqueIds) {
      const allowed = activeIds === null || activeIds.has(id);
      result.set(id, {
        allowed,
        sellingPrice: overrides.get(id) ?? null,
      });
    }
    return result;
  }

  static async listCatalogue(
    organizationId: string,
    branchId: string,
    options?: { search?: string },
  ): Promise<AssortmentCatalogue> {
    await AssortmentService.assertBranch(organizationId, branchId);

    const search = options?.search?.trim();
    const variants = await prisma.productVariant.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        product: {
          organizationId,
          deletedAt: null,
          isActive: true,
        },
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: "insensitive" as const } },
                { name: { contains: search, mode: "insensitive" as const } },
                {
                  product: {
                    OR: [
                      {
                        name: {
                          contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        sku: {
                          contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      select: {
        id: true,
        sku: true,
        name: true,
        sellingPrice: true,
        productId: true,
        product: { select: { name: true } },
      },
      take: 500,
    });

    const rows = await prisma.branchProduct.findMany({
      where: { organizationId, branchId },
      select: {
        variantId: true,
        isActive: true,
        sellingPrice: true,
      },
    });
    const rowMap = new Map(rows.map((r) => [r.variantId, r]));
    const mode: AssortmentMode = rows.length > 0 ? "restricted" : "open";

    const items: AssortmentItem[] = variants.map((v) => {
      const row = rowMap.get(v.id);
      return {
        variantId: v.id,
        productId: v.productId,
        productName: v.product.name,
        sku: v.sku,
        variantName: v.name,
        baseSellingPrice: Number(v.sellingPrice),
        isActive: mode === "open" ? true : Boolean(row?.isActive),
        sellingPriceOverride:
          row?.sellingPrice != null ? Number(row.sellingPrice) : null,
      };
    });

    return {
      mode,
      activeCount: items.filter((i) => i.isActive).length,
      totalCount: items.length,
      items,
    };
  }

  static async setVariant(
    organizationId: string,
    branchId: string,
    variantId: string,
    data: { isActive?: boolean; sellingPrice?: number | null },
  ) {
    await AssortmentService.assertBranch(organizationId, branchId);
    await AssortmentService.assertVariant(organizationId, variantId);

    const restricted = await AssortmentService.isRestricted(
      organizationId,
      branchId,
    );

    // Materialize full catalogue before first restriction change.
    if (!restricted) {
      await AssortmentService.enableAll(organizationId, branchId);
    }

    const existing = await prisma.branchProduct.findUnique({
      where: { branchId_variantId: { branchId, variantId } },
    });

    const isActive = data.isActive ?? existing?.isActive ?? true;
    const sellingPrice =
      data.sellingPrice === undefined
        ? existing?.sellingPrice ?? null
        : data.sellingPrice == null
          ? null
          : new Decimal(data.sellingPrice);

    if (data.sellingPrice != null && data.sellingPrice < 0) {
      throw new ValidationError("Branch price cannot be negative");
    }

    return prisma.branchProduct.upsert({
      where: { branchId_variantId: { branchId, variantId } },
      create: {
        organizationId,
        branchId,
        variantId,
        isActive,
        sellingPrice,
      },
      update: {
        isActive,
        sellingPrice,
      },
    });
  }

  /** Copy every active org variant into the branch as active (restricts catalogue). */
  static async enableAll(organizationId: string, branchId: string) {
    await AssortmentService.assertBranch(organizationId, branchId);

    const variants = await prisma.productVariant.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        product: { organizationId, deletedAt: null, isActive: true },
      },
      select: { id: true },
    });

    if (variants.length === 0) {
      throw new ValidationError("No active products to enable");
    }

    await prisma.$transaction(async (tx) => {
      await tx.branchProduct.deleteMany({ where: { organizationId, branchId } });
      await tx.branchProduct.createMany({
        data: variants.map((v) => ({
          organizationId,
          branchId,
          variantId: v.id,
          isActive: true,
        })),
      });
    });

    return { count: variants.length };
  }

  /** Delete all assortment rows → open catalogue for the branch. */
  static async clearAssortment(organizationId: string, branchId: string) {
    await AssortmentService.assertBranch(organizationId, branchId);
    const result = await prisma.branchProduct.deleteMany({
      where: { organizationId, branchId },
    });
    return { count: result.count };
  }

  private static async assertBranch(
    organizationId: string,
    branchId: string,
  ) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError("Branch");
  }

  private static async assertVariant(
    organizationId: string,
    variantId: string,
  ) {
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: variantId,
        deletedAt: null,
        product: { organizationId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!variant) throw new NotFoundError("Product variant");
  }
}

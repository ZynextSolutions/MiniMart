import { prisma } from "@/infrastructure/database/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

export async function assertVariantsBelongToOrg(
  organizationId: string,
  variantIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(variantIds)];
  if (uniqueIds.length === 0) return;

  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: uniqueIds },
      deletedAt: null,
      product: {
        organizationId,
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  if (variants.length !== uniqueIds.length) {
    throw new NotFoundError("Product variant");
  }
}

export async function assertSupplierBelongsToOrg(
  organizationId: string,
  supplierId: string,
): Promise<void> {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!supplier) throw new NotFoundError("Supplier");
}

export async function assertWarehouseBelongsToOrg(
  organizationId: string,
  warehouseId: string,
): Promise<void> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!warehouse) throw new NotFoundError("Warehouse");
}

import { prisma } from "@/infrastructure/database/prisma";
import { CashRegisterService } from "@/lib/services/cash-register-service";
import { calculateCartTotals } from "@/lib/services/pos-calculation";
import { TaxSettingsService } from "@/lib/services/tax-settings-service";
import { normalizeTaxRatePercent } from "@/lib/utils/tax";
import { Decimal } from "@prisma/client/runtime/library";

/** Fixed IDs from prisma/seed.ts */
export const SEED_IDS = {
  orgId: "00000000-0000-0000-0000-000000000001",
  branchId: "00000000-0000-0000-0000-000000000002",
  warehouseId: "00000000-0000-0000-0000-000000000003",
  registerId: "00000000-0000-0000-0000-000000000004",
  cashierEmail: "cashier@minimart.com",
} as const;

export async function assertSeededDatabase() {
  const org = await prisma.organization.findUnique({ where: { id: SEED_IDS.orgId } });
  if (!org) {
    throw new Error("Seeded database not found. Run: npm run db:seed");
  }
}

export async function getCashierUserId() {
  const user = await prisma.user.findFirst({
    where: {
      organizationId: SEED_IDS.orgId,
      email: SEED_IDS.cashierEmail,
      isActive: true,
      deletedAt: null,
    },
  });
  if (!user) throw new Error("Cashier user not found in seed data");
  return user.id;
}

export async function ensureOpenRegisterSession(userId: string) {
  const existing = await prisma.cashRegisterSession.findFirst({
    where: { cashRegisterId: SEED_IDS.registerId, status: "OPEN" },
  });
  if (existing) return existing;

  return CashRegisterService.openSession(
    SEED_IDS.registerId,
    0,
    userId,
    SEED_IDS.orgId,
  );
}

export async function getStockedVariant(minQty = 5) {
  const stock = await prisma.stockLevel.findFirst({
    where: {
      warehouseId: SEED_IDS.warehouseId,
      quantity: { gte: new Decimal(minQty + 1) },
      variant: { deletedAt: null, isActive: true, product: { deletedAt: null, isActive: true } },
    },
    include: {
      variant: {
        include: {
          product: { include: { taxRate: true } },
        },
      },
    },
    orderBy: { quantity: "desc" },
  });

  if (!stock) {
    throw new Error("No variant with sufficient stock found. Run: npm run db:seed");
  }

  return stock;
}

export function buildSaleLineFromStock(
  stock: Awaited<ReturnType<typeof getStockedVariant>>,
  quantity = 1,
) {
  const variant = stock.variant;
  const taxRate = variant.product.taxRate
    ? normalizeTaxRatePercent(Number(variant.product.taxRate.rate))
    : 0;

  return {
    variantId: variant.id,
    productName: variant.product.name,
    sku: variant.sku,
    unitPrice: Number(variant.sellingPrice),
    quantity,
    taxRateId: variant.product.taxRate?.id,
    taxRate,
    costPrice: Number(variant.costPrice),
  };
}

export function buildCashPayment(grandTotal: number) {
  return [{ method: "CASH" as const, amount: grandTotal }];
}

export async function computeGrandTotal(
  line: ReturnType<typeof buildSaleLineFromStock>,
) {
  const taxMode = await TaxSettingsService.getTaxMode(SEED_IDS.orgId);
  return calculateCartTotals(
    [
      {
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        taxRate: line.taxRate,
      },
    ],
    null,
    0,
    taxMode,
  ).grandTotal;
}

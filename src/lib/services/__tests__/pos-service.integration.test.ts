import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { InsufficientStockError } from "@/lib/errors/app-error";
import { PosService } from "@/lib/services/pos-service";
import { Decimal } from "@prisma/client/runtime/library";
import {
  SEED_IDS,
  assertSeededDatabase,
  buildCashPayment,
  buildSaleLineFromStock,
  computeGrandTotal,
  ensureOpenRegisterSession,
  getCashierUserId,
  getStockedVariant,
} from "./helpers/sale-fixture";

const INTEGRATION = process.env.INTEGRATION_TEST === "true";

async function integrationReady() {
  if (!INTEGRATION) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    await assertSeededDatabase();
    return true;
  } catch {
    return false;
  }
}

const ready = await integrationReady();

describe.runIf(ready)("PosService.completeSale (integration)", () => {
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    userId = await getCashierUserId();
    const session = await ensureOpenRegisterSession(userId);
    sessionId = session.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("completes a cash sale with inventory and journal posting", async () => {
    const stock = await getStockedVariant();
    const line = buildSaleLineFromStock(stock, 1);
    const grandTotal = await computeGrandTotal(line);
    const idempotencyKey = `integration-happy-${Date.now()}`;

    const sale = await PosService.completeSale({
      organizationId: SEED_IDS.orgId,
      branchId: SEED_IDS.branchId,
      userId,
      warehouseId: SEED_IDS.warehouseId,
      sessionId,
      cashRegisterId: SEED_IDS.registerId,
      lines: [line],
      payments: buildCashPayment(grandTotal),
      idempotencyKey,
    });

    expect(sale.status).toBe("COMPLETED");
    expect(sale.lines).toHaveLength(1);
    expect(Number(sale.grandTotal)).toBeCloseTo(grandTotal, 2);

    const updatedStock = await prisma.stockLevel.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId: SEED_IDS.warehouseId,
          variantId: line.variantId,
        },
      },
    });
    expect(Number(updatedStock!.quantity)).toBeCloseTo(Number(stock.quantity) - 1, 2);

    const journal = await prisma.journalEntry.findFirst({
      where: {
        organizationId: SEED_IDS.orgId,
        referenceType: "Sale",
        referenceId: sale.id,
      },
      include: { lines: true },
    });
    expect(journal).not.toBeNull();

    const totalDebit = journal!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = journal!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);

    const audit = await prisma.auditLog.findFirst({
      where: {
        organizationId: SEED_IDS.orgId,
        entityType: "Sale",
        entityId: sale.id,
        action: "pos.sale.completed",
      },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects sale when stock is insufficient", async () => {
    const stock = await getStockedVariant();
    const line = buildSaleLineFromStock(stock, 1);
    const grandTotal = await computeGrandTotal(line);

    const originalQty = stock.quantity;
    await prisma.stockLevel.update({
      where: {
        warehouseId_variantId: {
          warehouseId: SEED_IDS.warehouseId,
          variantId: line.variantId,
        },
      },
      data: { quantity: new Decimal(0) },
    });

    try {
      await expect(
        PosService.completeSale({
          organizationId: SEED_IDS.orgId,
          branchId: SEED_IDS.branchId,
          userId,
          warehouseId: SEED_IDS.warehouseId,
          sessionId,
          cashRegisterId: SEED_IDS.registerId,
          lines: [line],
          payments: buildCashPayment(grandTotal),
          idempotencyKey: `integration-oos-${Date.now()}`,
        }),
      ).rejects.toBeInstanceOf(InsufficientStockError);
    } finally {
      await prisma.stockLevel.update({
        where: {
          warehouseId_variantId: {
            warehouseId: SEED_IDS.warehouseId,
            variantId: line.variantId,
          },
        },
        data: { quantity: originalQty },
      });
    }
  });

  it("returns the same sale when idempotency key is reused", async () => {
    const stock = await getStockedVariant(2);
    const line = buildSaleLineFromStock(stock, 1);
    const grandTotal = await computeGrandTotal(line);
    const idempotencyKey = `integration-idem-${Date.now()}`;

    const dto = {
      organizationId: SEED_IDS.orgId,
      branchId: SEED_IDS.branchId,
      userId,
      warehouseId: SEED_IDS.warehouseId,
      sessionId,
      cashRegisterId: SEED_IDS.registerId,
      lines: [line],
      payments: buildCashPayment(grandTotal),
      idempotencyKey,
    };

    const first = await PosService.completeSale(dto);
    const second = await PosService.completeSale(dto);

    expect(second.id).toBe(first.id);

    const saleCount = await prisma.sale.count({
      where: { idempotencyKey },
    });
    expect(saleCount).toBe(1);

    const journalCount = await prisma.journalEntry.count({
      where: { idempotencyKey: `journal-${idempotencyKey}` },
    });
    expect(journalCount).toBe(1);
  });
});

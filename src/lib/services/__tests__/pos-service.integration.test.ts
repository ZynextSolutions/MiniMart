import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { InsufficientStockError, ValidationError } from "@/lib/errors/app-error";
import { CashRegisterService } from "@/lib/services/cash-register-service";
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

if (ready) {
  afterAll(async () => {
    await prisma.$disconnect();
  });
}

describe.runIf(ready)("PosService.completeSale (integration)", () => {
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    userId = await getCashierUserId();
    const session = await ensureOpenRegisterSession(userId);
    sessionId = session.id;
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

describe.runIf(ready)("PosService.processReturn (integration)", () => {
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    userId = await getCashierUserId();
    const session = await ensureOpenRegisterSession(userId);
    sessionId = session.id;
  });

  it("rejects duplicate variant lines in the same return request", async () => {
    const stock = await getStockedVariant(2);
    const line = buildSaleLineFromStock(stock, 1);
    const grandTotal = await computeGrandTotal(line);

    const original = await PosService.completeSale({
      organizationId: SEED_IDS.orgId,
      branchId: SEED_IDS.branchId,
      userId,
      warehouseId: SEED_IDS.warehouseId,
      sessionId,
      cashRegisterId: SEED_IDS.registerId,
      lines: [line],
      payments: buildCashPayment(grandTotal),
      idempotencyKey: `integration-return-original-${Date.now()}`,
    });

    await expect(
      PosService.processReturn({
        organizationId: SEED_IDS.orgId,
        branchId: SEED_IDS.branchId,
        userId,
        warehouseId: SEED_IDS.warehouseId,
        sessionId,
        cashRegisterId: SEED_IDS.registerId,
        originalSaleId: original.id,
        lines: [
          { ...line, quantity: 1 },
          { ...line, quantity: 1 },
        ],
        payments: buildCashPayment(grandTotal * 2),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns the same return sale when idempotency key is reused", async () => {
    const stock = await getStockedVariant(2);
    const line = buildSaleLineFromStock(stock, 1);
    const grandTotal = await computeGrandTotal(line);

    const original = await PosService.completeSale({
      organizationId: SEED_IDS.orgId,
      branchId: SEED_IDS.branchId,
      userId,
      warehouseId: SEED_IDS.warehouseId,
      sessionId,
      cashRegisterId: SEED_IDS.registerId,
      lines: [line],
      payments: buildCashPayment(grandTotal),
      idempotencyKey: `integration-return-source-${Date.now()}`,
    });

    const idempotencyKey = `integration-return-idem-${Date.now()}`;
    const dto = {
      organizationId: SEED_IDS.orgId,
      branchId: SEED_IDS.branchId,
      userId,
      warehouseId: SEED_IDS.warehouseId,
      sessionId,
      cashRegisterId: SEED_IDS.registerId,
      originalSaleId: original.id,
      lines: [{ ...line, quantity: 1 }],
      payments: buildCashPayment(grandTotal),
      idempotencyKey,
    };

    const first = await PosService.processReturn(dto);
    const second = await PosService.processReturn(dto);

    expect(second.id).toBe(first.id);

    const returnCount = await prisma.sale.count({
      where: { idempotencyKey },
    });
    expect(returnCount).toBe(1);

    const journalCount = await prisma.journalEntry.count({
      where: { referenceType: "SaleReturn", referenceId: first.id },
    });
    expect(journalCount).toBe(1);

    const movementCount = await prisma.inventoryMovement.count({
      where: { referenceType: "SaleReturn", referenceId: first.id },
    });
    expect(movementCount).toBe(1);
  });
});

describe.runIf(ready)("Cash register summary with returns (integration)", () => {
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    userId = await getCashierUserId();
    const session = await ensureOpenRegisterSession(userId);
    sessionId = session.id;
  });

  it("shows returns as cash-out and nets expected drawer cash", async () => {
    const stock = await getStockedVariant(2);
    const line = buildSaleLineFromStock(stock, 1);
    const grandTotal = await computeGrandTotal(line);

    const original = await PosService.completeSale({
      organizationId: SEED_IDS.orgId,
      branchId: SEED_IDS.branchId,
      userId,
      warehouseId: SEED_IDS.warehouseId,
      sessionId,
      cashRegisterId: SEED_IDS.registerId,
      lines: [line],
      payments: buildCashPayment(grandTotal),
      idempotencyKey: `integration-cash-summary-sale-${Date.now()}`,
    });

    await PosService.processReturn({
      organizationId: SEED_IDS.orgId,
      branchId: SEED_IDS.branchId,
      userId,
      warehouseId: SEED_IDS.warehouseId,
      sessionId,
      cashRegisterId: SEED_IDS.registerId,
      originalSaleId: original.id,
      lines: [{ ...line, quantity: 1 }],
      payments: buildCashPayment(grandTotal),
      idempotencyKey: `integration-cash-summary-return-${Date.now()}`,
    });

    const summary = await CashRegisterService.getSessionSummary(sessionId, SEED_IDS.orgId);

    expect(summary.totalSales).toBeGreaterThanOrEqual(grandTotal);
    expect(summary.returnTotal).toBeGreaterThanOrEqual(grandTotal);
    expect(summary.cashTotal).toBeGreaterThanOrEqual(grandTotal);
    expect(summary.cashRefundTotal).toBeGreaterThanOrEqual(grandTotal);
    expect(summary.netCash).toBeCloseTo(summary.cashTotal - summary.cashRefundTotal, 2);
    expect(summary.expectedCash).toBeCloseTo(summary.openingBalance + summary.netCash, 2);
  });
});

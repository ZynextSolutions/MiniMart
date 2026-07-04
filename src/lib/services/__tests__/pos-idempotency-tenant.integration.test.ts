import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { PosService } from "@/lib/services/pos-service";
import {
  SEED_IDS,
  assertSeededDatabase,
  buildCashPayment,
  buildSaleLineFromStock,
  computeGrandTotal,
  ensureOpenRegisterSession,
  getCashierUserId,
  getStockedVariant,
} from "@/lib/services/__tests__/helpers/sale-fixture";

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

describe.runIf(ready)("cross-tenant idempotency (integration)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("scopes idempotency keys per organization", async () => {
    const userId = await getCashierUserId();
    const session = await ensureOpenRegisterSession(userId);
    const stock = await getStockedVariant();
    const line = buildSaleLineFromStock(stock, 1);
    const grandTotal = await computeGrandTotal(line);
    const sharedKey = `tenant-idem-${Date.now()}`;

    const orgASale = await PosService.completeSale({
      organizationId: SEED_IDS.orgId,
      branchId: SEED_IDS.branchId,
      userId,
      warehouseId: SEED_IDS.warehouseId,
      sessionId: session.id,
      cashRegisterId: SEED_IDS.registerId,
      lines: [line],
      payments: buildCashPayment(grandTotal),
      idempotencyKey: sharedKey,
    });

    const otherOrg = await prisma.organization.create({
      data: {
        name: "Idempotency Test Org",
        slug: `idem-test-${Date.now()}`,
        email: `idem-${Date.now()}@test.local`,
        status: "TRIAL",
      },
    });

    try {
      await expect(
        prisma.sale.create({
          data: {
            organizationId: otherOrg.id,
            branchId: SEED_IDS.branchId,
            invoiceNumber: `IDEM-${Date.now()}`,
            saleDate: new Date(),
            cashierId: userId,
            status: "COMPLETED",
            subtotal: 1,
            grandTotal: 1,
            amountPaid: 1,
            idempotencyKey: sharedKey,
          },
        }),
      ).resolves.toBeTruthy();

      const orgACount = await prisma.sale.count({
        where: { organizationId: SEED_IDS.orgId, idempotencyKey: sharedKey },
      });
      const orgBCount = await prisma.sale.count({
        where: { organizationId: otherOrg.id, idempotencyKey: sharedKey },
      });

      expect(orgACount).toBe(1);
      expect(orgBCount).toBe(1);
      expect(orgASale.organizationId).toBe(SEED_IDS.orgId);
    } finally {
      await prisma.sale.deleteMany({ where: { organizationId: otherOrg.id } });
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    }
  });
});

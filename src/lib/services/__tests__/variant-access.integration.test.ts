import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import { InventoryService } from "@/lib/services/inventory-service";
import { assertVariantsBelongToOrg } from "@/lib/services/variant-access";
import {
  SEED_IDS,
  assertSeededDatabase,
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

describe.runIf(ready)("variant ownership (integration)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("accepts variants belonging to the organization", async () => {
    const stock = await getStockedVariant();
    await expect(
      assertVariantsBelongToOrg(SEED_IDS.orgId, [stock.variantId]),
    ).resolves.toBeUndefined();
  });

  it("rejects foreign organization variants", async () => {
    const stock = await getStockedVariant();
    const otherOrg = await prisma.organization.create({
      data: {
        name: "Variant Test Org",
        slug: `variant-test-${Date.now()}`,
        email: `variant-${Date.now()}@test.local`,
        status: "TRIAL",
      },
    });

    try {
      await expect(
        assertVariantsBelongToOrg(otherOrg.id, [stock.variantId]),
      ).rejects.toBeInstanceOf(NotFoundError);
    } finally {
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    }
  });

  it("rejects stock-in with foreign variant", async () => {
    const stock = await getStockedVariant();
    const userId = await getCashierUserId();
    const otherOrg = await prisma.organization.create({
      data: {
        name: "Stock In Test Org",
        slug: `stock-test-${Date.now()}`,
        email: `stock-${Date.now()}@test.local`,
        status: "TRIAL",
      },
    });

    try {
      await expect(
        InventoryService.stockIn(
          {
            warehouseId: SEED_IDS.warehouseId,
            movementDate: new Date(),
            lines: [{ variantId: stock.variantId, quantity: 1 }],
          },
          { organizationId: otherOrg.id, userId },
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
    } finally {
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    }
  });
});

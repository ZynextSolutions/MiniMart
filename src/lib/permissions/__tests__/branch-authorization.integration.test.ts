import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { ForbiddenError } from "@/lib/errors/app-error";
import { authorize, can } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  SEED_IDS,
  assertSeededDatabase,
  getCashierUserId,
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

describe.runIf(ready)("branch-scoped authorization (integration)", () => {
  let cashierUserId: string;

  beforeAll(async () => {
    cashierUserId = await getCashierUserId();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("grants POS sale permission for assigned branch", async () => {
    const allowed = await can(cashierUserId, PERMISSIONS.POS.SALE_CREATE, {
      branchId: SEED_IDS.branchId,
    });
    expect(allowed).toBe(true);
  });

  it("denies POS sale permission for unassigned branch", async () => {
    const fakeBranchId = "00000000-0000-0000-0000-000000009999";
    const allowed = await can(cashierUserId, PERMISSIONS.POS.SALE_CREATE, {
      branchId: fakeBranchId,
    });
    expect(allowed).toBe(false);
  });

  it("authorize throws ForbiddenError for unassigned branch", async () => {
    const fakeBranchId = "00000000-0000-0000-0000-000000009999";
    await expect(
      authorize(cashierUserId, PERMISSIONS.POS.SALE_CREATE, { branchId: fakeBranchId }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    branchProduct: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    branch: {
      findFirst: vi.fn(),
    },
    productVariant: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: prismaMock,
}));

import { AssortmentService } from "@/features/products/services/assortment.service";

const ORG = "11111111-1111-1111-1111-111111111111";
const BRANCH = "22222222-2222-2222-2222-222222222222";
const V1 = "33333333-3333-3333-3333-333333333333";
const V2 = "44444444-4444-4444-4444-444444444444";

describe("AssortmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.branch.findFirst.mockResolvedValue({ id: BRANCH });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
  });

  describe("getActiveVariantIds", () => {
    it("returns null when branch has no assortment rows (open catalogue)", async () => {
      prismaMock.branchProduct.findMany.mockResolvedValue([]);
      await expect(
        AssortmentService.getActiveVariantIds(ORG, BRANCH),
      ).resolves.toBeNull();
    });

    it("returns only active variant ids when restricted", async () => {
      prismaMock.branchProduct.findMany.mockResolvedValue([
        { variantId: V1, isActive: true },
        { variantId: V2, isActive: false },
      ]);
      const ids = await AssortmentService.getActiveVariantIds(ORG, BRANCH);
      expect(ids).toEqual(new Set([V1]));
    });
  });

  describe("resolveVariantsForSale", () => {
    it("allows all variants with optional overrides in open mode", async () => {
      prismaMock.branchProduct.findMany
        .mockResolvedValueOnce([]) // getActiveVariantIds
        .mockResolvedValueOnce([
          { variantId: V1, sellingPrice: 9.5 },
        ]); // getPriceOverrides

      const map = await AssortmentService.resolveVariantsForSale(ORG, BRANCH, [
        V1,
        V2,
      ]);
      expect(map.get(V1)).toEqual({ allowed: true, sellingPrice: 9.5 });
      expect(map.get(V2)).toEqual({ allowed: true, sellingPrice: null });
    });

    it("blocks variants missing from restricted assortment", async () => {
      prismaMock.branchProduct.findMany
        .mockResolvedValueOnce([{ variantId: V1, isActive: true }])
        .mockResolvedValueOnce([]);

      const map = await AssortmentService.resolveVariantsForSale(ORG, BRANCH, [
        V1,
        V2,
      ]);
      expect(map.get(V1)?.allowed).toBe(true);
      expect(map.get(V2)?.allowed).toBe(false);
    });
  });

  describe("setVariant", () => {
    it("materializes full catalogue before first restriction change", async () => {
      prismaMock.productVariant.findFirst.mockResolvedValue({ id: V1 });
      prismaMock.branchProduct.count.mockResolvedValue(0);
      prismaMock.productVariant.findMany.mockResolvedValue([
        { id: V1 },
        { id: V2 },
      ]);
      prismaMock.branchProduct.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.branchProduct.createMany.mockResolvedValue({ count: 2 });
      prismaMock.branchProduct.findUnique.mockResolvedValue({
        isActive: true,
        sellingPrice: null,
      });
      prismaMock.branchProduct.upsert.mockResolvedValue({ id: "bp-1" });

      await AssortmentService.setVariant(ORG, BRANCH, V1, { isActive: false });

      expect(prismaMock.branchProduct.createMany).toHaveBeenCalled();
      expect(prismaMock.branchProduct.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchId_variantId: { branchId: BRANCH, variantId: V1 } },
          update: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });

  describe("clearAssortment", () => {
    it("deletes all branch product rows", async () => {
      prismaMock.branchProduct.deleteMany.mockResolvedValue({ count: 3 });
      await expect(
        AssortmentService.clearAssortment(ORG, BRANCH),
      ).resolves.toEqual({ count: 3 });
    });
  });
});

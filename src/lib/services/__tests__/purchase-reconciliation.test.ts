import { describe, expect, it } from "vitest";
import { PurchaseReconciliationService } from "@/lib/services/purchase-reconciliation.service";
import { Decimal } from "@prisma/client/runtime/library";

describe("PurchaseReconciliationService", () => {
  const grnLines = [
    {
      id: "grn-line-1",
      variantId: "variant-1",
      quantity: new Decimal(100),
      invoicedQty: new Decimal(0),
      unitCost: new Decimal(1200),
    },
    {
      id: "grn-line-2",
      variantId: "variant-2",
      quantity: new Decimal(50),
      invoicedQty: new Decimal(0),
      unitCost: new Decimal(2000),
    },
  ];

  it("calculates favorable and unfavorable variance", () => {
    const result = PurchaseReconciliationService.buildReconciliation(grnLines, [
      {
        goodsReceiptLineId: "grn-line-1",
        variantId: "variant-1",
        quantity: 100,
        unitCost: 1250,
      },
      {
        goodsReceiptLineId: "grn-line-2",
        variantId: "variant-2",
        quantity: 50,
        unitCost: 2000,
      },
    ]);

    expect(result.grnSubtotal).toBe(220_000);
    expect(result.invoiceSubtotal).toBe(225_000);
    expect(result.varianceAmount).toBe(5_000);
    expect(result.reconciliationStatus).toBe("RECONCILED");
    expect(result.lines[0]?.variance).toBe(5_000);
    expect(result.lines[1]?.variance).toBe(0);
  });

  it("supports partial invoicing", () => {
    const result = PurchaseReconciliationService.buildReconciliation(grnLines, [
      {
        goodsReceiptLineId: "grn-line-1",
        variantId: "variant-1",
        quantity: 40,
        unitCost: 1250,
      },
    ]);

    expect(result.grnSubtotal).toBe(48_000);
    expect(result.invoiceSubtotal).toBe(50_000);
    expect(result.varianceAmount).toBe(2_000);
    expect(result.reconciliationStatus).toBe("PARTIAL");
  });

  it("rejects invoice quantity above remaining receipt quantity", () => {
    expect(() =>
      PurchaseReconciliationService.buildReconciliation(grnLines, [
        {
          goodsReceiptLineId: "grn-line-1",
          variantId: "variant-1",
          quantity: 101,
          unitCost: 1250,
        },
      ]),
    ).toThrow(/exceeds uninvoiced receipt quantity/i);
  });
});

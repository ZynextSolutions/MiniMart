import { describe, expect, it } from "vitest";
import {
  calculateCartTotals,
  calculateChange,
  calculateLine,
} from "../pos-calculation";

describe("calculateLine", () => {
  it("calculates exclusive tax without discount", () => {
    const result = calculateLine({
      unitPrice: 100,
      quantity: 2,
      taxRate: 10,
    });

    expect(result.subtotal).toBe(200);
    expect(result.discountAmount).toBe(0);
    expect(result.afterDiscount).toBe(200);
    expect(result.taxAmount).toBe(20);
    expect(result.lineTotal).toBe(220);
  });

  it("applies percent line discount with exclusive tax", () => {
    const result = calculateLine({
      unitPrice: 100,
      quantity: 1,
      taxRate: 10,
      lineDiscount: { type: "PERCENT", value: 10 },
    });

    expect(result.subtotal).toBe(100);
    expect(result.discountAmount).toBe(10);
    expect(result.afterDiscount).toBe(90);
    expect(result.taxAmount).toBe(9);
    expect(result.lineTotal).toBe(99);
  });

  it("calculates inclusive tax", () => {
    const result = calculateLine(
      {
        unitPrice: 110,
        quantity: 1,
        taxRate: 10,
      },
      "INCLUSIVE",
    );

    expect(result.subtotal).toBe(100);
    expect(result.taxAmount).toBe(10);
    expect(result.lineTotal).toBe(110);
  });
});

describe("calculateCartTotals", () => {
  it("aggregates multiple lines with order discount and coupon", () => {
    const totals = calculateCartTotals(
      [
        { unitPrice: 50, quantity: 2, taxRate: 10 },
        { unitPrice: 30, quantity: 1, taxRate: 0 },
      ],
      { type: "FIXED", value: 10 },
      5,
    );

    expect(totals.subtotal).toBe(130);
    expect(totals.orderDiscountAmount).toBe(10);
    expect(totals.couponDiscount).toBe(5);
    expect(totals.taxableAmount).toBe(115);
    expect(totals.taxTotal).toBe(8.85);
    expect(totals.grandTotal).toBe(123.85);
  });
});

describe("calculateChange", () => {
  it("returns zero when underpaid", () => {
    expect(calculateChange(50, 100)).toBe(0);
  });

  it("returns correct change when overpaid", () => {
    expect(calculateChange(150, 125.5)).toBe(24.5);
  });
});

export type DiscountType = "PERCENT" | "FIXED";
import type { TaxMode } from "@/lib/utils/tax";

export interface Discount {
  type: DiscountType;
  value: number;
}

export interface CartLineInput {
  unitPrice: number;
  quantity: number;
  taxRate: number;
  lineDiscount?: Discount | null;
}

export interface CalculatedLine {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  // Pre-tax amount after line-level discount.
  afterDiscount: number;
  taxRate: number;
}

export interface CartTotals {
  subtotal: number;
  lineDiscountTotal: number;
  orderDiscountAmount: number;
  couponDiscount: number;
  taxableAmount: number;
  taxTotal: number;
  grandTotal: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateLine(
  line: CartLineInput,
  taxMode: TaxMode = "EXCLUSIVE",
): CalculatedLine {
  const grossSubtotal = round2(line.unitPrice * line.quantity);
  let discountGross = 0;

  if (line.lineDiscount && line.lineDiscount.value > 0) {
    discountGross =
      line.lineDiscount.type === "PERCENT"
        ? round2(grossSubtotal * (line.lineDiscount.value / 100))
        : round2(Math.min(line.lineDiscount.value, grossSubtotal));
  }

  const afterDiscountGross = round2(grossSubtotal - discountGross);

  if (taxMode === "INCLUSIVE" && line.taxRate > 0) {
    const divisor = 1 + line.taxRate / 100;
    const subtotalBeforeDiscount = round2(grossSubtotal / divisor);
    const subtotalAfterDiscount = round2(afterDiscountGross / divisor);
    const discountAmount = round2(subtotalBeforeDiscount - subtotalAfterDiscount);
    const taxAmount = round2(afterDiscountGross - subtotalAfterDiscount);
    return {
      subtotal: subtotalBeforeDiscount,
      discountAmount,
      taxAmount,
      lineTotal: afterDiscountGross,
      afterDiscount: subtotalAfterDiscount,
      taxRate: line.taxRate,
    };
  }

  const subtotal = grossSubtotal;
  const discountAmount = discountGross;
  const afterDiscount = round2(subtotal - discountAmount);
  const taxAmount = round2(afterDiscount * (line.taxRate / 100));
  const lineTotal = round2(afterDiscount + taxAmount);
  return {
    subtotal,
    discountAmount,
    taxAmount,
    lineTotal,
    afterDiscount,
    taxRate: line.taxRate,
  };
}

export function calculateCartTotals(
  lines: CartLineInput[],
  orderDiscount?: Discount | null,
  couponDiscount = 0,
  taxMode: TaxMode = "EXCLUSIVE",
): CartTotals {
  const calculated = lines.map((line) => calculateLine(line, taxMode));

  const subtotal = round2(calculated.reduce((s, l) => s + l.subtotal, 0));
  const lineDiscountTotal = round2(calculated.reduce((s, l) => s + l.discountAmount, 0));
  const baseTaxableAmount = round2(calculated.reduce((s, l) => s + l.afterDiscount, 0));

  let orderDiscountAmountRaw = 0;
  if (orderDiscount && orderDiscount.value > 0) {
    const base = baseTaxableAmount;
    orderDiscountAmountRaw =
      orderDiscount.type === "PERCENT"
        ? round2(base * (orderDiscount.value / 100))
        : round2(Math.min(orderDiscount.value, base));
  }

  const orderDiscountAmount = round2(Math.min(baseTaxableAmount, Math.max(0, orderDiscountAmountRaw)));
  const remainingAfterOrder = round2(Math.max(0, baseTaxableAmount - orderDiscountAmount));
  const coupon = round2(Math.min(remainingAfterOrder, Math.max(0, couponDiscount)));
  const taxableAmount = round2(Math.max(0, remainingAfterOrder - coupon));

  const taxableRatio = baseTaxableAmount > 0 ? taxableAmount / baseTaxableAmount : 0;
  const taxTotal = round2(
    calculated.reduce(
      (sum, line) => sum + round2(round2(line.afterDiscount * taxableRatio) * (line.taxRate / 100)),
      0,
    ),
  );
  const grandTotal = round2(taxableAmount + taxTotal);

  return {
    subtotal,
    lineDiscountTotal,
    orderDiscountAmount,
    couponDiscount: coupon,
    taxableAmount,
    taxTotal,
    grandTotal,
  };
}

export function calculateChange(amountPaid: number, grandTotal: number): number {
  return round2(Math.max(0, amountPaid - grandTotal));
}

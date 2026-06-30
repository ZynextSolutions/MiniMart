export type TaxMode = "EXCLUSIVE" | "INCLUSIVE";

export function normalizeTaxRatePercent(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  // DB tax rates are stored as fractions (0.07 = 7%), while POS math expects percent.
  return rate <= 1 ? rate * 100 : rate;
}


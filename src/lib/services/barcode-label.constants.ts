export type BarcodeFormat = "CODE128" | "EAN13" | "QR";

export type LabelTemplate = "label-40x30" | "label-a4-3x8" | "label-a4-4x10";

export const LABEL_TEMPLATES: Record<
  LabelTemplate,
  { name: string; cols: number; rows: number; widthMm: number; heightMm: number; pageSize?: string }
> = {
  "label-40x30": {
    name: "40×30mm (Thermal)",
    cols: 1,
    rows: 1,
    widthMm: 40,
    heightMm: 30,
  },
  "label-a4-3x8": {
    name: "A4 — 3×8 (24 labels)",
    cols: 3,
    rows: 8,
    widthMm: 70,
    heightMm: 37,
    pageSize: "A4",
  },
  "label-a4-4x10": {
    name: "A4 — 4×10 (40 labels)",
    cols: 4,
    rows: 10,
    widthMm: 52.5,
    heightMm: 29.7,
    pageSize: "A4",
  },
};

export interface LabelItem {
  productName: string;
  sku: string;
  barcode: string;
  price: string;
  barcodeFormat: BarcodeFormat;
}

export function validateCode128(value: string): boolean {
  return value.length > 0 && value.length <= 80 && /^[\x20-\x7E]+$/.test(value);
}

export function validateEAN13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(value[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(value[12], 10);
}

export function ean13CheckDigit(base12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base12[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

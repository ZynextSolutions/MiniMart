import QRCode from "qrcode";

export type BarcodeFormat = "CODE128" | "EAN13" | "QR";

export interface BarcodeImageResult {
  format: BarcodeFormat;
  value: string;
  svg?: string;
  dataUrl?: string;
}

/** Server-side barcode/QR generation (SVG or PNG data URL) */
export class BarcodeImageService {
  static async generateQR(data: string, size = 200): Promise<BarcodeImageResult> {
    const dataUrl = await QRCode.toDataURL(data, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    return { format: "QR", value: data, dataUrl };
  }

  static validateCode128(value: string): boolean {
    return value.length > 0 && value.length <= 80 && /^[\x20-\x7E]+$/.test(value);
  }

  static validateEAN13(value: string): boolean {
    if (!/^\d{13}$/.test(value)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(value[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;
    return check === parseInt(value[12], 10);
  }

  /** Compute EAN13 check digit for 12-digit base */
  static ean13CheckDigit(base12: string): string {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(base12[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    return String((10 - (sum % 10)) % 10);
  }
}

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

export function buildLabelPrintHtml(
  items: LabelItem[],
  template: LabelTemplate,
): string {
  const t = LABEL_TEMPLATES[template];
  const labels: LabelItem[] = [];
  for (const item of items) {
    labels.push(item);
  }

  const labelCells = labels
    .map(
      (item) => `
    <div class="label" style="width:${t.widthMm}mm;height:${t.heightMm}mm">
      <div class="label-name">${escapeHtml(item.productName.slice(0, 28))}</div>
      <div class="label-price">${escapeHtml(item.price)}</div>
      <svg class="label-barcode" data-code="${escapeHtml(item.barcode)}" data-format="${item.barcodeFormat}"></svg>
      <div class="label-sku">${escapeHtml(item.sku)} · ${escapeHtml(item.barcode)}</div>
    </div>`,
    )
    .join("");

  const pageRule = t.pageSize
    ? `@page { size: ${t.pageSize}; margin: 5mm; }`
    : `@page { size: ${t.widthMm}mm ${t.heightMm}mm; margin: 0; }`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Barcode Labels</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    ${pageRule}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    .sheet {
      display: grid;
      grid-template-columns: repeat(${t.cols}, ${t.widthMm}mm);
      gap: 2mm;
    }
    .label {
      border: 1px dashed #ccc;
      padding: 2mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .label-name { font-size: 8pt; font-weight: bold; text-align: center; line-height: 1.2; }
    .label-price { font-size: 10pt; font-weight: bold; }
    .label-barcode { max-width: 100%; height: 12mm; }
    .label-sku { font-size: 6pt; color: #333; }
    @media print { .label { border: none; } }
  </style>
</head>
<body>
  <div class="sheet">${labelCells}</div>
  <script>
    document.querySelectorAll('.label-barcode').forEach(function(el) {
      var code = el.getAttribute('data-code');
      var fmt = el.getAttribute('data-format');
      try {
        if (fmt === 'QR') {
          el.outerHTML = '<img src="" class="label-barcode" id="qr-' + code + '" />';
          return;
        }
        JsBarcode(el, code, {
          format: fmt === 'EAN13' ? 'EAN13' : 'CODE128',
          width: 1.2,
          height: 40,
          displayValue: true,
          fontSize: 10,
          margin: 0
        });
      } catch(e) { el.textContent = code; }
    });
  <\/script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

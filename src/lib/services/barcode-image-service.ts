import "server-only";

import { readFileSync } from "fs";
import { join } from "path";
import QRCode from "qrcode";
import {
  LABEL_TEMPLATES,
  ean13CheckDigit,
  validateCode128,
  validateEAN13,
  type BarcodeFormat,
  type LabelItem,
  type LabelTemplate,
} from "@/lib/services/barcode-label.constants";

export type { BarcodeFormat, LabelItem, LabelTemplate };
export { LABEL_TEMPLATES };

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
    return validateCode128(value);
  }

  static validateEAN13(value: string): boolean {
    return validateEAN13(value);
  }

  static ean13CheckDigit(base12: string): string {
    return ean13CheckDigit(base12);
  }
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

  const jsBarcodeScript = readFileSync(
    join(process.cwd(), "node_modules/jsbarcode/dist/JsBarcode.all.min.js"),
    "utf-8",
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Barcode Labels</title>
  <script>${jsBarcodeScript}<\/script>
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

import { formatMoney, formatNumber } from "@/lib/utils/format";
import { formatOrgDateTime } from "@/lib/utils/datetime";
import { EscPosBuilder } from "@/lib/services/esc-pos-builder";
import type { TaxMode } from "@/lib/utils/tax";
import QRCode from "qrcode";

export interface ReceiptLine {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
}

export interface ReceiptData {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  taxId?: string;
  invoiceNumber: string;
  saleDate: Date;
  cashierName: string;
  customerName?: string;
  lines: ReceiptLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  changeAmount: number;
  payments: { method: string; amount: number; reference?: string }[];
  logoUrl?: string;
  verificationUrl?: string;
  currency?: string;
  taxMode?: TaxMode;
  timezone?: string;
}

export class ReceiptService {
  static getVerificationUrl(baseUrl: string, invoiceNumber: string): string {
    return `${baseUrl.replace(/\/$/, "")}/verify/${encodeURIComponent(invoiceNumber)}`;
  }

  static generateHtml(data: ReceiptData, width: "58" | "80" = "80"): string {
    const w = width === "58" ? "58mm" : "80mm";
    const money = (value: number) => formatMoney(value, data.currency);
    const subtotalLabel = data.taxMode === "INCLUSIVE" ? "Total Price" : "Subtotal";
    const subtotalValue = data.taxMode === "INCLUSIVE" ? data.grandTotal : data.subtotal;
    const saleDateLabel = formatOrgDateTime(data.saleDate, data.timezone);

    const linesHtml = data.lines
      .map(
        (l) => `
      <tr>
        <td colspan="3">${escapeHtml(l.productName)}</td>
      </tr>
      <tr>
        <td>${formatNumber(l.quantity)} × ${money(l.unitPrice)}</td>
        <td></td>
        <td style="text-align:right">${money(l.lineTotal)}</td>
      </tr>`,
      )
      .join("");

    const paymentsHtml = data.payments
      .map(
        (p) =>
          `<div class="row"><span>${p.method}</span><span>${money(p.amount)}</span></div>`,
      )
      .join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt ${escapeHtml(data.invoiceNumber)}</title>
  <style>
    @page { size: ${w} auto; margin: 2mm; }
    body { font-family: monospace; font-size: 12px; width: ${w}; margin: 0 auto; padding: 4px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .row { display: flex; justify-content: space-between; }
    .total { font-size: 14px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="center bold">${escapeHtml(data.companyName)}</div>
  ${data.logoUrl ? `<div class="center"><img src="${escapeHtml(data.logoUrl)}" style="max-width:80%;max-height:40px" alt="logo" /></div>` : ""}
  ${data.companyAddress ? `<div class="center">${escapeHtml(data.companyAddress)}</div>` : ""}
  ${data.companyPhone ? `<div class="center">Tel: ${escapeHtml(data.companyPhone)}</div>` : ""}
  ${data.taxId ? `<div class="center">Tax ID: ${escapeHtml(data.taxId)}</div>` : ""}
  <div class="divider"></div>
  <div>Invoice: ${escapeHtml(data.invoiceNumber)}</div>
  <div>Date: ${escapeHtml(saleDateLabel)}</div>
  <div>Cashier: ${escapeHtml(data.cashierName)}</div>
  <div>Customer: ${escapeHtml(data.customerName ?? "Walk-in")}</div>
  <div class="divider"></div>
  <table>${linesHtml}</table>
  <div class="divider"></div>
  <div class="row"><span>${subtotalLabel}</span><span>${money(subtotalValue)}</span></div>
  ${data.discountAmount > 0 ? `<div class="row"><span>Discount</span><span>-${money(data.discountAmount)}</span></div>` : ""}
  <div class="row"><span>Tax</span><span>${money(data.taxAmount)}</span></div>
  <div class="row total"><span>TOTAL</span><span>${money(data.grandTotal)}</span></div>
  <div class="divider"></div>
  ${paymentsHtml}
  <div class="row"><span>Change</span><span>${money(data.changeAmount)}</span></div>
  <div class="divider"></div>
  ${data.verificationUrl ? `<div class="center" style="font-size:9px">${escapeHtml(data.verificationUrl)}</div>` : ""}
  <div class="center">Thank you for shopping!</div>
</body>
</html>`;
  }

  static async generateHtmlWithQr(
    data: ReceiptData,
    width: "58" | "80" = "80",
  ): Promise<string> {
    let verificationUrl = data.verificationUrl;
    if (verificationUrl) {
      try {
        const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 120, margin: 1 });
        const html = this.generateHtml({ ...data, verificationUrl: undefined }, width);
        return html.replace(
          '<div class="center">Thank you for shopping!</div>',
          `<div class="center"><img src="${qrDataUrl}" width="80" height="80" alt="QR" /></div>
  <div class="center" style="font-size:9px">${escapeHtml(verificationUrl)}</div>
  <div class="center">Thank you for shopping!</div>`,
        );
      } catch {
        // fall through
      }
    }
    return this.generateHtml(data, width);
  }

  static generateEscPos(
    data: ReceiptData,
    options?: { width?: "58" | "80"; logoBitmap?: { bitmap: Uint8Array; widthPx: number } },
  ): Uint8Array {
    const chars = options?.width === "58" ? 32 : 42;
    const money = (value: number) => formatMoney(value, data.currency);
    const subtotalLabel = data.taxMode === "INCLUSIVE" ? "Total Price" : "Subtotal";
    const subtotalValue = data.taxMode === "INCLUSIVE" ? data.grandTotal : data.subtotal;
    const saleDateLabel = formatOrgDateTime(data.saleDate, data.timezone);
    const b = new EscPosBuilder().init().align("center");

    if (options?.logoBitmap) {
      b.image(options.logoBitmap.bitmap, options.logoBitmap.widthPx).line();
    }

    b.bold(true).size(1, 2).line(data.companyName).size(1, 1).bold(false);

    if (data.companyAddress) b.line(data.companyAddress);
    if (data.companyPhone) b.line(`Tel: ${data.companyPhone}`);
    if (data.taxId) b.line(`Tax ID: ${data.taxId}`);

    b.align("left").separator("-", chars);
    b.line(`Invoice: ${data.invoiceNumber}`);
    b.line(`Date: ${saleDateLabel}`);
    b.line(`Cashier: ${data.cashierName}`);
    b.line(`Customer: ${data.customerName ?? "Walk-in"}`);
    b.separator("-", chars);

    for (const l of data.lines) {
      b.line(l.productName);
      b.line(
        `${formatNumber(l.quantity)} x ${money(l.unitPrice)}`.padEnd(chars - 10) +
          money(l.lineTotal).padStart(10),
      );
    }

    b.separator("-", chars);
    b.line(`${subtotalLabel}:${"".padStart(chars - subtotalLabel.length - 1 - money(subtotalValue).length)}${money(subtotalValue)}`);
    if (data.discountAmount > 0) {
      b.line(`Discount:${"".padStart(chars - 10 - money(data.discountAmount).length)}-${money(data.discountAmount)}`);
    }
    b.line(`Tax:${"".padStart(chars - 5 - money(data.taxAmount).length)}${money(data.taxAmount)}`);
    b.bold(true).line(`TOTAL:${"".padStart(chars - 7 - money(data.grandTotal).length)}${money(data.grandTotal)}`).bold(false);
    b.separator("-", chars);

    for (const p of data.payments) {
      b.line(`${p.method}:${"".padStart(chars - p.method.length - money(p.amount).length)}${money(p.amount)}`);
    }
    b.line(`Change:${"".padStart(chars - 8 - money(data.changeAmount).length)}${money(data.changeAmount)}`);

    b.separator("-", chars).align("center");
    if (data.verificationUrl) {
      b.qrcode(data.verificationUrl, 4).line();
      b.line(data.verificationUrl.slice(0, chars));
    }
    b.line("Thank you for shopping!").feed(2).cut();

    return b.build();
  }

  static generateCashDrawerKick(): Uint8Array {
    return new EscPosBuilder().init().cashDrawer().build();
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

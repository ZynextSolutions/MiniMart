import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ReportService } from "@/features/reports/services/report.service";
import { apiErrorResponse } from "@/lib/auth/api-error-response";
import { enforceApiRateLimit } from "@/lib/rate-limit";
import {
  ReportExportService,
  type ExportTableData,
} from "@/lib/services/report-export.service";

function parseDateRange(searchParams: URLSearchParams) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const fromRaw = searchParams.get("from") ?? monthStart;
  const toRaw = searchParams.get("to") ?? today;
  return {
    from: new Date(`${fromRaw}T00:00:00.000`),
    to: new Date(`${toRaw}T23:59:59.999`),
    branchId: searchParams.get("branchId") ?? undefined,
    query: searchParams.get("query") ?? undefined,
    paymentMethod: searchParams.get("paymentMethod") ?? undefined,
  };
}

function formatExportMoney(value: number, currency: string): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  const code = currency.toUpperCase();
  if (code === "MMK") return `Ks ${formatted}`;
  return `${formatted} ${code}`;
}

function dateRangeSubtitle(from: Date, to: Date) {
  return `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`;
}

async function buildExportData(
  type: string,
  organizationId: string,
  currency: string,
  filters: ReturnType<typeof parseDateRange>,
  title: string,
): Promise<ExportTableData | null> {
  const base = {
    organizationId,
    branchId: filters.branchId,
    from: filters.from,
    to: filters.to,
  };
  const money = (value: number) => formatExportMoney(value, currency);
  const rangeSubtitle = dateRangeSubtitle(filters.from, filters.to);

  switch (type) {
    case "daily-sales": {
      const report = await ReportService.getDailySales(base);
      return {
        title,
        subtitle: rangeSubtitle,
        columns: [
          { header: "Date", key: "date", width: 72 },
          { header: "Total Txn", key: "totalTransactionCount", align: "right", width: 56 },
          { header: "Sales Txn", key: "transactionCount", align: "right", width: 56 },
          { header: "Returns", key: "returnCount", align: "right", width: 56 },
          { header: "Gross Sales", key: "totalSales", align: "right", width: 88 },
          { header: "Sales Returns", key: "totalReturns", align: "right", width: 88 },
          { header: "Net Sales", key: "netSales", align: "right", width: 88 },
          { header: "Tax", key: "totalTax", align: "right", width: 88 },
          { header: "Discount", key: "totalDiscount", align: "right", width: 88 },
        ],
        rows: report.rows.map((r) => ({
          date: r.date,
          totalTransactionCount: r.totalTransactionCount,
          transactionCount: r.transactionCount,
          returnCount: r.returnCount,
          totalSales: money(r.totalSales),
          totalReturns: money(r.totalReturns),
          netSales: money(r.netSales),
          totalTax: money(r.totalTax),
          totalDiscount: money(r.totalDiscount),
        })),
        summary: {
          "Net Sales": money(report.totals.netSales),
          "Gross Sales": money(report.totals.totalSales),
          Returns: money(report.totals.totalReturns),
          "Total Txn": report.totals.totalTransactionCount,
        },
      };
    }
    case "sales-by-product": {
      const report = await ReportService.getSalesByProduct({ ...base, pageSize: 500 });
      return {
        title,
        subtitle: rangeSubtitle,
        columns: [
          { header: "SKU", key: "sku", width: 72 },
          { header: "Product", key: "productName", width: 160 },
          { header: "Qty", key: "quantity", align: "right", width: 48 },
          { header: "Revenue", key: "revenue", align: "right", width: 88 },
        ],
        rows: report.rows.map((r) => ({
          sku: r.sku,
          productName: r.productName,
          quantity: r.quantity,
          revenue: money(r.revenue),
        })),
      };
    }
    case "sales-by-category": {
      const report = await ReportService.getSalesByCategory(base);
      return {
        title,
        subtitle: rangeSubtitle,
        columns: [
          { header: "Category", key: "categoryName", width: 140 },
          { header: "Qty", key: "quantity", align: "right", width: 48 },
          { header: "Revenue", key: "revenue", align: "right", width: 88 },
        ],
        rows: report.rows.map((r) => ({
          categoryName: r.categoryName,
          quantity: r.quantity,
          revenue: money(r.revenue),
        })),
      };
    }
    case "sales-by-cashier": {
      const report = await ReportService.getSalesByCashier(base);
      return {
        title,
        subtitle: rangeSubtitle,
        columns: [
          { header: "Cashier", key: "cashierName", width: 140 },
          { header: "Total Txn", key: "totalTransactionCount", align: "right", width: 56 },
          { header: "Sales Txn", key: "transactionCount", align: "right", width: 56 },
          { header: "Returns", key: "returnCount", align: "right", width: 56 },
          { header: "Gross Sales", key: "totalSales", align: "right", width: 88 },
          { header: "Sales Returns", key: "totalReturns", align: "right", width: 88 },
          { header: "Net Sales", key: "netSales", align: "right", width: 88 },
        ],
        rows: report.rows.map((r) => ({
          cashierName: r.cashierName,
          totalTransactionCount: r.totalTransactionCount,
          transactionCount: r.transactionCount,
          returnCount: r.returnCount,
          totalSales: money(r.totalSales),
          totalReturns: money(r.totalReturns),
          netSales: money(r.netSales),
        })),
      };
    }
    case "sales-by-payment": {
      const report = await ReportService.getSalesByPaymentMethod(base);
      return {
        title,
        subtitle: rangeSubtitle,
        columns: [
          { header: "Method", key: "method", width: 100 },
          { header: "Total Txn", key: "transactionCount", align: "right", width: 56 },
          { header: "Sales Txn", key: "saleCount", align: "right", width: 56 },
          { header: "Returns", key: "returnCount", align: "right", width: 56 },
          { header: "Gross Sales", key: "grossAmount", align: "right", width: 88 },
          { header: "Sales Returns", key: "refundAmount", align: "right", width: 88 },
          { header: "Net Amount", key: "netAmount", align: "right", width: 88 },
        ],
        rows: report.rows.map((r) => ({
          method: r.method,
          transactionCount: r.transactionCount,
          saleCount: r.saleCount,
          returnCount: r.returnCount,
          grossAmount: money(r.grossAmount),
          refundAmount: money(r.refundAmount),
          netAmount: money(r.netAmount),
        })),
      };
    }
    case "invoice-list": {
      const report = await ReportService.getSalesInvoiceList(base, {
        query: filters.query,
        paymentMethod: filters.paymentMethod,
      });
      return {
        title,
        subtitle: rangeSubtitle,
        columns: [
          { header: "Invoice", key: "invoiceNumber", width: 96 },
          { header: "Date", key: "saleDate", width: 72 },
          { header: "Customer", key: "customerName", width: 120 },
          { header: "Cashier", key: "cashierName", width: 120 },
          { header: "Methods", key: "paymentMethods", width: 100 },
          { header: "Tax", key: "taxAmount", align: "right", width: 80 },
          { header: "Total", key: "grandTotal", align: "right", width: 88 },
        ],
        rows: report.rows.map((r) => ({
          invoiceNumber: r.invoiceNumber,
          saleDate: r.saleDate.toISOString().slice(0, 10),
          customerName: r.customerName,
          cashierName: r.cashierName,
          paymentMethods: r.paymentMethods,
          taxAmount: money(r.taxAmount),
          grandTotal: money(r.grandTotal),
        })),
      };
    }
    case "return-list": {
      const report = await ReportService.getReturnList(base, {
        query: filters.query,
        paymentMethod: filters.paymentMethod,
      });
      return {
        title,
        subtitle: rangeSubtitle,
        columns: [
          { header: "Return Invoice", key: "returnInvoiceNumber", width: 96 },
          { header: "Original Invoice", key: "originalInvoiceNumber", width: 120 },
          { header: "Date", key: "saleDate", width: 72 },
          { header: "Cashier", key: "cashierName", width: 120 },
          { header: "Methods", key: "paymentMethods", width: 100 },
          { header: "Tax", key: "taxAmount", align: "right", width: 80 },
          { header: "Refund", key: "refundAmount", align: "right", width: 88 },
        ],
        rows: report.rows.map((r) => ({
          returnInvoiceNumber: r.returnInvoiceNumber,
          originalInvoiceNumber: r.originalInvoiceNumber ?? r.originalSaleId ?? "-",
          saleDate: r.saleDate.toISOString().slice(0, 10),
          cashierName: r.cashierName,
          paymentMethods: r.paymentMethods,
          taxAmount: money(r.taxAmount),
          refundAmount: money(r.refundAmount),
        })),
      };
    }
    case "profit-by-product": {
      const report = await ReportService.getProfitByProduct(base);
      return {
        title,
        subtitle: rangeSubtitle,
        columns: [
          { header: "SKU", key: "sku", width: 64 },
          { header: "Product", key: "productName", width: 120 },
          { header: "Revenue", key: "revenue", align: "right", width: 80 },
          { header: "COGS", key: "cogs", align: "right", width: 80 },
          { header: "Margin", key: "margin", align: "right", width: 80 },
          { header: "Margin %", key: "marginPct", align: "right", width: 56 },
        ],
        rows: report.rows.map((r) => ({
          sku: r.sku,
          productName: r.productName,
          revenue: money(r.revenue),
          cogs: money(r.cogs),
          margin: money(r.margin),
          marginPct: `${r.marginPct}%`,
        })),
      };
    }
    case "tax-report": {
      const report = await ReportService.getTaxReport(base);
      const netLabel = report.netTax >= 0 ? "Net Tax Payable" : "Net Tax Credit";
      const byRateRows = report.outputByRate.flatMap((r) => [
        { item: `${r.rateLabel} Sales Base`, amount: money(r.salesTaxableBase) },
        { item: `${r.rateLabel} Sales VAT`, amount: money(r.salesTax) },
        { item: `${r.rateLabel} Return Base`, amount: `-${money(r.returnTaxableBase)}` },
        { item: `${r.rateLabel} Return VAT`, amount: `-${money(r.returnTax)}` },
        { item: `${r.rateLabel} Net Output VAT`, amount: money(r.netOutputTax) },
      ]);
      return {
        title,
        subtitle: rangeSubtitle,
        columns: [
          { header: "Item", key: "item", width: 180 },
          { header: "Amount", key: "amount", align: "right", width: 100 },
        ],
        rows: [
          { item: "Sales Gross (excl. tax)", amount: money(report.salesGrossSubtotal) },
          { item: "Sales Discounts", amount: `-${money(report.salesDiscount)}` },
          { item: "Sales Taxable Base", amount: money(report.salesTaxableBase) },
          { item: "Output VAT on Sales", amount: money(report.outputTaxSales) },
          { item: "Sales Returns Gross (excl. tax)", amount: `-${money(report.returnGrossSubtotal)}` },
          { item: "Return Taxable Base Reversal", amount: `-${money(report.returnTaxableBase)}` },
          { item: "Output VAT Reversal (Returns)", amount: `-${money(report.outputTaxReturns)}` },
          { item: "Net Output VAT", amount: money(report.netOutputTax) },
          ...byRateRows,
          { item: "Input Tax (Purchases)", amount: money(report.inputTax) },
          { item: netLabel, amount: money(Math.abs(report.netTax)) },
          { item: "Net Taxable Sales", amount: money(report.netTaxableSales) },
          { item: "Purchase Subtotal", amount: money(report.purchaseSubtotal) },
        ],
      };
    }
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await enforceApiRateLimit(request, "reports-export", 30);
    const session = await requireApiSession(PERMISSIONS.REPORTS.EXPORT);

    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type");
    const format = searchParams.get("format") ?? "pdf";
    const title = searchParams.get("title") ?? "Report";

    if (!type) {
      return NextResponse.json({ error: "Missing report type" }, { status: 400 });
    }

    const filters = parseDateRange(searchParams);
    const data = await buildExportData(
      type,
      session.user.organizationId,
      session.user.currency,
      filters,
      title,
    );

    if (!data) {
      return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
    }

    const filename = `${type}-${filters.to.toISOString().slice(0, 10)}`;

    if (format === "excel") {
      const buffer = await ReportExportService.exportToExcel(data);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      });
    }

    const buffer = await ReportExportService.exportToPdf(data);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

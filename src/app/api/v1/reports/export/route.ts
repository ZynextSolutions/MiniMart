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
  const base = { organizationId, ...filters };
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
          { header: "Transactions", key: "transactionCount", align: "right", width: 72 },
          { header: "Sales", key: "totalSales", align: "right", width: 88 },
          { header: "Tax", key: "totalTax", align: "right", width: 88 },
          { header: "Discount", key: "totalDiscount", align: "right", width: 88 },
        ],
        rows: report.rows.map((r) => ({
          date: r.date,
          transactionCount: r.transactionCount,
          totalSales: money(r.totalSales),
          totalTax: money(r.totalTax),
          totalDiscount: money(r.totalDiscount),
        })),
        summary: {
          Total: money(report.totals.totalSales),
          Transactions: report.totals.transactionCount,
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
          { header: "Transactions", key: "transactionCount", align: "right", width: 72 },
          { header: "Total Sales", key: "totalSales", align: "right", width: 88 },
        ],
        rows: report.rows.map((r) => ({
          cashierName: r.cashierName,
          transactionCount: r.transactionCount,
          totalSales: money(r.totalSales),
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
          { header: "Count", key: "transactionCount", align: "right", width: 56 },
          { header: "Amount", key: "totalAmount", align: "right", width: 88 },
        ],
        rows: report.rows.map((r) => ({
          method: r.method,
          transactionCount: r.transactionCount,
          totalAmount: money(r.totalAmount),
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
      return {
        title,
        subtitle: rangeSubtitle,
        columns: [
          { header: "Item", key: "item", width: 180 },
          { header: "Amount", key: "amount", align: "right", width: 100 },
        ],
        rows: [
          { item: "Output Tax (Sales)", amount: money(report.outputTax) },
          { item: "Input Tax (Purchases)", amount: money(report.inputTax) },
          { item: "Net Tax Payable", amount: money(report.netTax) },
          { item: "Sales Subtotal", amount: money(report.salesSubtotal) },
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

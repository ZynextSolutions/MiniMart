"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ReportFiltersBar } from "./report-filters-bar";
import { ReportTable } from "./report-table";
import { formatMoney } from "@/lib/utils/format";

interface SalesReportClientProps {
  view: string;
  branches: { id: string; name: string }[];
  from: string;
  to: string;
  branchId?: string;
  query?: string;
  paymentMethod?: string;
  summary: {
    grossSales: number;
    returnsTotal: number;
    netSales: number;
    salesCount: number;
    returnCount: number;
    totalTransactionCount: number;
  };
  dailySales?: {
    rows: {
      date: string;
      transactionCount: number;
      returnCount: number;
      totalTransactionCount: number;
      totalSales: number;
      totalReturns: number;
      netSales: number;
      totalTax: number;
      totalDiscount: number;
    }[];
    totals: {
      transactionCount: number;
      returnCount: number;
      totalTransactionCount: number;
      totalSales: number;
      totalReturns: number;
      netSales: number;
      totalTax: number;
      totalDiscount: number;
    };
  };
  byProduct?: {
    rows: { sku: string; productName: string; quantity: number; revenue: number }[];
  };
  byCategory?: {
    rows: { categoryName: string; quantity: number; revenue: number }[];
  };
  byCashier?: {
    rows: {
      cashierName: string;
      transactionCount: number;
      returnCount: number;
      totalTransactionCount: number;
      totalSales: number;
      totalReturns: number;
      netSales: number;
    }[];
  };
  byPayment?: {
    rows: {
      method: string;
      saleCount: number;
      returnCount: number;
      transactionCount: number;
      grossAmount: number;
      refundAmount: number;
      netAmount: number;
    }[];
  };
  invoiceList?: {
    rows: {
      invoiceNumber: string;
      saleDate: Date | string;
      customerName: string;
      cashierName: string;
      paymentMethods: string;
      taxAmount: number;
      grandTotal: number;
    }[];
  };
  returnList?: {
    rows: {
      returnInvoiceNumber: string;
      originalSaleId: string | null;
      originalInvoiceNumber: string | null;
      saleDate: Date | string;
      cashierName: string;
      paymentMethods: string;
      taxAmount: number;
      refundAmount: number;
    }[];
  };
}

const VIEWS = [
  { id: "daily", label: "Daily Sales", exportType: "daily-sales" },
  { id: "product", label: "By Product", exportType: "sales-by-product" },
  { id: "category", label: "By Category", exportType: "sales-by-category" },
  { id: "cashier", label: "By Cashier", exportType: "sales-by-cashier" },
  { id: "payment", label: "By Payment", exportType: "sales-by-payment" },
  { id: "invoices", label: "Invoice List", exportType: "invoice-list" },
  { id: "returns", label: "Return List", exportType: "return-list" },
];

export function SalesReportClient(props: SalesReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = VIEWS.find((v) => v.id === props.view) ?? VIEWS[0];

  function viewHref(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", id);
    return `?${params.toString()}`;
  }

  function applyListFilters(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    const query = String(form.get("query") ?? "").trim();
    const paymentMethod = String(form.get("paymentMethod") ?? "").trim();
    if (query) params.set("query", query);
    else params.delete("query");
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    else params.delete("paymentMethod");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link key={v.id} href={viewHref(v.id)}>
            <span
              className={cn(
                "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                props.view === v.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {v.label}
            </span>
          </Link>
        ))}
      </div>

      <ReportFiltersBar
        mode="range"
        defaultFrom={props.from}
        defaultTo={props.to}
        defaultBranchId={props.branchId}
        branches={props.branches}
        exportReportType={currentView.exportType}
        exportTitle={`Sales Report - ${currentView.label}`}
      />

      <div className="grid gap-4 sm:grid-cols-5">
        <StatCard label="Gross Sales" value={formatMoney(props.summary.grossSales)} />
        <StatCard label="Sales Returns" value={`-${formatMoney(props.summary.returnsTotal)}`} />
        <StatCard label="Net Sales" value={formatMoney(props.summary.netSales)} />
        <StatCard label="Invoices" value={String(props.summary.salesCount)} />
        <StatCard label="Returns" value={String(props.summary.returnCount)} />
      </div>

      {props.view === "daily" && props.dailySales && (
        <>
          <div className="grid gap-4 sm:grid-cols-5">
            <StatCard label="Total Txn" value={String(props.dailySales.totals.totalTransactionCount)} />
            <StatCard label="Returns" value={String(props.dailySales.totals.returnCount)} />
            <StatCard label="Gross Sales" value={formatMoney(props.dailySales.totals.totalSales)} />
            <StatCard label="Net Sales" value={formatMoney(props.dailySales.totals.netSales)} />
            <StatCard label="Discounts" value={formatMoney(props.dailySales.totals.totalDiscount)} />
          </div>
          <ReportTable
            columns={[
              { header: "Date", key: "date" },
              { header: "Total Txn", key: "totalTransactionCount", align: "right" },
              { header: "Sales Txn", key: "transactionCount", align: "right" },
              { header: "Returns", key: "returnCount", align: "right" },
              { header: "Gross Sales", key: "totalSales", align: "right" },
              { header: "Sales Returns", key: "totalReturns", align: "right" },
              { header: "Net Sales", key: "netSales", align: "right" },
              { header: "Tax", key: "totalTax", align: "right" },
              { header: "Discount", key: "totalDiscount", align: "right" },
            ]}
            rows={props.dailySales.rows.map((r) => ({
              date: r.date,
              totalTransactionCount: r.totalTransactionCount,
              transactionCount: r.transactionCount,
              returnCount: r.returnCount,
              totalSales: formatMoney(r.totalSales),
              totalReturns: formatMoney(r.totalReturns),
              netSales: formatMoney(r.netSales),
              totalTax: formatMoney(r.totalTax),
              totalDiscount: formatMoney(r.totalDiscount),
            }))}
          />
        </>
      )}

      {props.view === "product" && props.byProduct && (
        <ReportTable
          columns={[
            { header: "SKU", key: "sku" },
            { header: "Product", key: "productName" },
            { header: "Qty", key: "quantity", align: "right" },
            { header: "Revenue", key: "revenue", align: "right" },
          ]}
          rows={props.byProduct.rows.map((r) => ({
            sku: r.sku,
            productName: r.productName,
            quantity: r.quantity,
            revenue: formatMoney(r.revenue),
          }))}
        />
      )}

      {props.view === "category" && props.byCategory && (
        <ReportTable
          columns={[
            { header: "Category", key: "categoryName" },
            { header: "Qty", key: "quantity", align: "right" },
            { header: "Revenue", key: "revenue", align: "right" },
          ]}
          rows={props.byCategory.rows.map((r) => ({
            categoryName: r.categoryName,
            quantity: r.quantity,
            revenue: formatMoney(r.revenue),
          }))}
        />
      )}

      {props.view === "cashier" && props.byCashier && (
        <ReportTable
          columns={[
            { header: "Cashier", key: "cashierName" },
            { header: "Total Txn", key: "totalTransactionCount", align: "right" },
            { header: "Sales Txn", key: "transactionCount", align: "right" },
            { header: "Returns", key: "returnCount", align: "right" },
            { header: "Gross Sales", key: "totalSales", align: "right" },
            { header: "Sales Returns", key: "totalReturns", align: "right" },
            { header: "Net Sales", key: "netSales", align: "right" },
          ]}
          rows={props.byCashier.rows.map((r) => ({
            cashierName: r.cashierName,
            totalTransactionCount: r.totalTransactionCount,
            transactionCount: r.transactionCount,
            returnCount: r.returnCount,
            totalSales: formatMoney(r.totalSales),
            totalReturns: formatMoney(r.totalReturns),
            netSales: formatMoney(r.netSales),
          }))}
        />
      )}

      {props.view === "payment" && props.byPayment && (
        <ReportTable
          columns={[
            { header: "Payment Method", key: "method" },
            { header: "Total Txn", key: "transactionCount", align: "right" },
            { header: "Sales Txn", key: "saleCount", align: "right" },
            { header: "Returns", key: "returnCount", align: "right" },
            { header: "Gross Sales", key: "grossAmount", align: "right" },
            { header: "Sales Returns", key: "refundAmount", align: "right" },
            { header: "Net Amount", key: "netAmount", align: "right" },
          ]}
          rows={props.byPayment.rows.map((r) => ({
            method: r.method,
            transactionCount: r.transactionCount,
            saleCount: r.saleCount,
            returnCount: r.returnCount,
            grossAmount: formatMoney(r.grossAmount),
            refundAmount: formatMoney(r.refundAmount),
            netAmount: formatMoney(r.netAmount),
          }))}
        />
      )}

      {(props.view === "invoices" || props.view === "returns") && (
        <form onSubmit={applyListFilters} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
          <div className="space-y-1">
            <label htmlFor="query" className="text-sm font-medium">
              Search
            </label>
            <input
              id="query"
              name="query"
              defaultValue={props.query ?? ""}
              placeholder="Invoice/customer/cashier"
              className="h-9 w-64 rounded-md border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="paymentMethod" className="text-sm font-medium">
              Payment Method
            </label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              defaultValue={props.paymentMethod ?? ""}
              className="h-9 w-44 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">All</option>
              <option value="CASH">CASH</option>
              <option value="CARD">CARD</option>
              <option value="QR">QR</option>
              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
              <option value="CREDIT">CREDIT</option>
            </select>
          </div>
          <button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground">
            Apply
          </button>
        </form>
      )}

      {props.view === "invoices" && props.invoiceList && (
        <ReportTable
          columns={[
            { header: "Invoice", key: "invoiceNumber" },
            { header: "Date", key: "saleDate" },
            { header: "Customer", key: "customerName" },
            { header: "Cashier", key: "cashierName" },
            { header: "Methods", key: "paymentMethods" },
            { header: "Tax", key: "taxAmount", align: "right" },
            { header: "Total", key: "grandTotal", align: "right" },
          ]}
          rows={props.invoiceList.rows.map((r) => ({
            invoiceNumber: r.invoiceNumber,
            saleDate: fmtDate(r.saleDate),
            customerName: r.customerName,
            cashierName: r.cashierName,
            paymentMethods: r.paymentMethods,
            taxAmount: formatMoney(r.taxAmount),
            grandTotal: formatMoney(r.grandTotal),
          }))}
        />
      )}

      {props.view === "returns" && props.returnList && (
        <ReportTable
          columns={[
            { header: "Return Invoice", key: "returnInvoiceNumber" },
            { header: "Original Invoice", key: "originalInvoiceNumber" },
            { header: "Date", key: "saleDate" },
            { header: "Cashier", key: "cashierName" },
            { header: "Methods", key: "paymentMethods" },
            { header: "Tax", key: "taxAmount", align: "right" },
            { header: "Refund", key: "refundAmount", align: "right" },
          ]}
          rows={props.returnList.rows.map((r) => ({
            returnInvoiceNumber: r.returnInvoiceNumber,
            originalInvoiceNumber: r.originalInvoiceNumber ?? r.originalSaleId ?? "-",
            saleDate: fmtDate(r.saleDate),
            cashierName: r.cashierName,
            paymentMethods: r.paymentMethods,
            taxAmount: formatMoney(r.taxAmount),
            refundAmount: formatMoney(r.refundAmount),
          }))}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function fmtDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
}

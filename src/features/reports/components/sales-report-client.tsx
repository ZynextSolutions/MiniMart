"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  dailySales?: {
    rows: { date: string; transactionCount: number; totalSales: number; totalTax: number; totalDiscount: number }[];
    totals: { transactionCount: number; totalSales: number; totalTax: number; totalDiscount: number };
  };
  byProduct?: {
    rows: { sku: string; productName: string; quantity: number; revenue: number }[];
  };
  byCategory?: {
    rows: { categoryName: string; quantity: number; revenue: number }[];
  };
  byCashier?: {
    rows: { cashierName: string; transactionCount: number; totalSales: number }[];
  };
  byPayment?: {
    rows: { method: string; transactionCount: number; totalAmount: number }[];
  };
}

const VIEWS = [
  { id: "daily", label: "Daily Sales", exportType: "daily-sales" },
  { id: "product", label: "By Product", exportType: "sales-by-product" },
  { id: "category", label: "By Category", exportType: "sales-by-category" },
  { id: "cashier", label: "By Cashier", exportType: "sales-by-cashier" },
  { id: "payment", label: "By Payment", exportType: "sales-by-payment" },
];

export function SalesReportClient(props: SalesReportClientProps) {
  const searchParams = useSearchParams();
  const currentView = VIEWS.find((v) => v.id === props.view) ?? VIEWS[0];

  function viewHref(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", id);
    return `?${params.toString()}`;
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

      {props.view === "daily" && props.dailySales && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Transactions" value={String(props.dailySales.totals.transactionCount)} />
            <StatCard label="Total Sales" value={formatMoney(props.dailySales.totals.totalSales)} />
            <StatCard label="Total Tax" value={formatMoney(props.dailySales.totals.totalTax)} />
            <StatCard label="Discounts" value={formatMoney(props.dailySales.totals.totalDiscount)} />
          </div>
          <ReportTable
            columns={[
              { header: "Date", key: "date" },
              { header: "Transactions", key: "transactionCount", align: "right" },
              { header: "Sales", key: "totalSales", align: "right" },
              { header: "Tax", key: "totalTax", align: "right" },
              { header: "Discount", key: "totalDiscount", align: "right" },
            ]}
            rows={props.dailySales.rows.map((r) => ({
              date: r.date,
              transactionCount: r.transactionCount,
              totalSales: formatMoney(r.totalSales),
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
            { header: "Transactions", key: "transactionCount", align: "right" },
            { header: "Total Sales", key: "totalSales", align: "right" },
          ]}
          rows={props.byCashier.rows.map((r) => ({
            cashierName: r.cashierName,
            transactionCount: r.transactionCount,
            totalSales: formatMoney(r.totalSales),
          }))}
        />
      )}

      {props.view === "payment" && props.byPayment && (
        <ReportTable
          columns={[
            { header: "Payment Method", key: "method" },
            { header: "Transactions", key: "transactionCount", align: "right" },
            { header: "Amount", key: "totalAmount", align: "right" },
          ]}
          rows={props.byPayment.rows.map((r) => ({
            method: r.method,
            transactionCount: r.transactionCount,
            totalAmount: formatMoney(r.totalAmount),
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

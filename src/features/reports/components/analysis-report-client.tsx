"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ReportFiltersBar } from "./report-filters-bar";
import { ReportTable } from "./report-table";
import { formatMoney } from "@/lib/utils/format";

interface AnalysisReportClientProps {
  view: string;
  branches: { id: string; name: string }[];
  from: string;
  to: string;
  branchId?: string;
  bestSelling?: { rows: { sku: string; productName: string; quantity: number; revenue: number }[] };
  slowMoving?: { rows: { sku: string; productName: string; warehouseName: string; stockQty: number; soldQty: number }[]; thresholdQty: number };
  deadStock?: { rows: { sku: string; productName: string; warehouseName: string; stockQty: number; stockValue: number }[] };
  profit?: {
    rows: { sku: string; productName: string; revenue: number; cogs: number; margin: number; marginPct: number }[];
    totals: { revenue: number; cogs: number; margin: number };
  };
}

const VIEWS = [
  { id: "profit", label: "Profit Margin", exportType: "profit-by-product" },
  { id: "best", label: "Best Selling", exportType: "sales-by-product" },
  { id: "slow", label: "Slow Moving" },
  { id: "dead", label: "Dead Stock" },
];

export function AnalysisReportClient(props: AnalysisReportClientProps) {
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
        exportTitle={`Analysis - ${currentView.label}`}
      />

      {props.view === "profit" && props.profit && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Revenue" value={formatMoney(props.profit.totals.revenue)} />
            <StatCard label="COGS" value={formatMoney(props.profit.totals.cogs)} />
            <StatCard label="Gross Margin" value={formatMoney(props.profit.totals.margin)} />
          </div>
          <ReportTable
            columns={[
              { header: "SKU", key: "sku" },
              { header: "Product", key: "productName" },
              { header: "Revenue", key: "revenue", align: "right" },
              { header: "COGS", key: "cogs", align: "right" },
              { header: "Margin", key: "margin", align: "right" },
              { header: "Margin %", key: "marginPct", align: "right" },
            ]}
            rows={props.profit.rows.map((r) => ({
              sku: r.sku,
              productName: r.productName,
              revenue: formatMoney(r.revenue),
              cogs: formatMoney(r.cogs),
              margin: formatMoney(r.margin),
              marginPct: `${r.marginPct.toFixed(1)}%`,
            }))}
          />
        </>
      )}

      {props.view === "best" && props.bestSelling && (
        <ReportTable
          columns={[
            { header: "SKU", key: "sku" },
            { header: "Product", key: "productName" },
            { header: "Qty Sold", key: "quantity", align: "right" },
            { header: "Revenue", key: "revenue", align: "right" },
          ]}
          rows={props.bestSelling.rows.map((r) => ({
            sku: r.sku,
            productName: r.productName,
            quantity: r.quantity,
            revenue: formatMoney(r.revenue),
          }))}
        />
      )}

      {props.view === "slow" && props.slowMoving && (
        <>
          <p className="text-sm text-muted-foreground">
            Products with stock but ≤ {props.slowMoving.thresholdQty} units sold in period
          </p>
          <ReportTable
            columns={[
              { header: "SKU", key: "sku" },
              { header: "Product", key: "productName" },
              { header: "Warehouse", key: "warehouseName" },
              { header: "Stock", key: "stockQty", align: "right" },
              { header: "Sold", key: "soldQty", align: "right" },
            ]}
            rows={props.slowMoving.rows.map((r) => ({
              sku: r.sku,
              productName: r.productName,
              warehouseName: r.warehouseName,
              stockQty: r.stockQty,
              soldQty: r.soldQty,
            }))}
          />
        </>
      )}

      {props.view === "dead" && props.deadStock && (
        <>
          <p className="text-sm text-muted-foreground">
            Products with stock but zero sales in the selected period
          </p>
          <ReportTable
            columns={[
              { header: "SKU", key: "sku" },
              { header: "Product", key: "productName" },
              { header: "Warehouse", key: "warehouseName" },
              { header: "Stock", key: "stockQty", align: "right" },
              { header: "Value", key: "stockValue", align: "right" },
            ]}
            rows={props.deadStock.rows.map((r) => ({
              sku: r.sku,
              productName: r.productName,
              warehouseName: r.warehouseName,
              stockQty: r.stockQty,
              stockValue: formatMoney(r.stockValue),
            }))}
          />
        </>
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

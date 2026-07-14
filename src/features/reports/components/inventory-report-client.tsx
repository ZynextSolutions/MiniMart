"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ReportFiltersBar } from "./report-filters-bar";
import { ReportTable } from "./report-table";
import { formatMoney } from "@/lib/utils/format";

interface InventoryReportClientProps {
  view: string;
  from: string;
  to: string;
  defaultBranchId?: string;
  branches?: { id: string; name: string }[];
  stockRows?: { sku: string; productName: string; warehouseName: string; quantity: string; value: string }[];
  valuationRows?: { sku: string; productName: string; warehouseName: string; quantity: string; totalValue: string }[];
  valuationTotal?: number;
  movementRows?: { movementNumber: string; movementType: string; movementDate: string; warehouseName: string; totalCost: string }[];
}

const VIEWS = [
  { id: "stock", label: "Stock on Hand" },
  { id: "valuation", label: "Valuation" },
  { id: "movement", label: "Movement" },
];

export function InventoryReportClient(props: InventoryReportClientProps) {
  const searchParams = useSearchParams();

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

      {props.view === "movement" ? (
        <ReportFiltersBar
          mode="range"
          defaultFrom={props.from}
          defaultTo={props.to}
          defaultBranchId={props.defaultBranchId}
          branches={props.branches}
        />
      ) : (
        <ReportFiltersBar
          mode="asOf"
          defaultAsOf={props.to}
          defaultBranchId={props.defaultBranchId}
          branches={props.branches}
        />
      )}

      {props.view === "stock" && props.stockRows && (
        <ReportTable
          columns={[
            { header: "SKU", key: "sku" },
            { header: "Product", key: "productName" },
            { header: "Warehouse", key: "warehouseName" },
            { header: "Qty", key: "quantity", align: "right" },
            { header: "Value", key: "value", align: "right" },
          ]}
          rows={props.stockRows}
        />
      )}

      {props.view === "valuation" && props.valuationRows && (
        <>
          {props.valuationTotal != null && (
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Total Inventory Value</p>
              <p className="text-2xl font-bold">{formatMoney(props.valuationTotal)}</p>
            </div>
          )}
          <ReportTable
            columns={[
              { header: "SKU", key: "sku" },
              { header: "Product", key: "productName" },
              { header: "Warehouse", key: "warehouseName" },
              { header: "Qty", key: "quantity", align: "right" },
              { header: "Value", key: "totalValue", align: "right" },
            ]}
            rows={props.valuationRows}
          />
        </>
      )}

      {props.view === "movement" && props.movementRows && (
        <ReportTable
          columns={[
            { header: "Number", key: "movementNumber" },
            { header: "Type", key: "movementType" },
            { header: "Date", key: "movementDate" },
            { header: "Warehouse", key: "warehouseName" },
            { header: "Cost", key: "totalCost", align: "right" },
          ]}
          rows={props.movementRows}
        />
      )}
    </div>
  );
}

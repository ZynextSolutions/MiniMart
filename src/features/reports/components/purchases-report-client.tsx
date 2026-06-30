"use client";

import { ReportFiltersBar } from "./report-filters-bar";
import { ReportTable } from "./report-table";
import { formatMoney } from "@/lib/utils/format";

interface PurchasesReportClientProps {
  branches: { id: string; name: string }[];
  from: string;
  to: string;
  branchId?: string;
  report: {
    supplierRows: { supplierCode: string; supplierName: string; orderCount: number; totalAmount: number }[];
    grnSummary: { receiptCount: number; totalValue: number };
    orderCount: number;
    orderTotal: number;
  };
}

export function PurchasesReportClient(props: PurchasesReportClientProps) {
  return (
    <div className="space-y-4">
      <ReportFiltersBar
        mode="range"
        defaultFrom={props.from}
        defaultTo={props.to}
        defaultBranchId={props.branchId}
        branches={props.branches}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Purchase Orders" value={String(props.report.orderCount)} />
        <StatCard label="PO Total" value={formatMoney(props.report.orderTotal)} />
        <StatCard label="GRN Count" value={String(props.report.grnSummary.receiptCount)} />
        <StatCard label="GRN Value" value={formatMoney(props.report.grnSummary.totalValue)} />
      </div>

      <ReportTable
        columns={[
          { header: "Code", key: "supplierCode" },
          { header: "Supplier", key: "supplierName" },
          { header: "Orders", key: "orderCount", align: "right" },
          { header: "Total", key: "totalAmount", align: "right" },
        ]}
        rows={props.report.supplierRows.map((r) => ({
          supplierCode: r.supplierCode,
          supplierName: r.supplierName,
          orderCount: r.orderCount,
          totalAmount: formatMoney(r.totalAmount),
        }))}
        emptyMessage="No purchase orders in this period."
      />
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

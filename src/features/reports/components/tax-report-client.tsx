"use client";

import { ReportFiltersBar } from "./report-filters-bar";
import { formatMoney } from "@/lib/utils/format";

interface TaxReportClientProps {
  branches: { id: string; name: string }[];
  from: string;
  to: string;
  branchId?: string;
  report: {
    outputTax: number;
    inputTax: number;
    netTax: number;
    salesSubtotal: number;
    purchaseSubtotal: number;
    salesCount: number;
    invoiceCount: number;
  };
}

export function TaxReportClient(props: TaxReportClientProps) {
  const r = props.report;

  return (
    <div className="space-y-4">
      <ReportFiltersBar
        mode="range"
        defaultFrom={props.from}
        defaultTo={props.to}
        defaultBranchId={props.branchId}
        branches={props.branches}
        exportReportType="tax-report"
        exportTitle="Tax Report"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Output Tax (Sales)" value={formatMoney(r.outputTax)} />
        <StatCard label="Input Tax (Purchases)" value={formatMoney(r.inputTax)} />
        <StatCard label="Net Tax Payable" value={formatMoney(r.netTax)} highlight />
        <StatCard label="Sales Transactions" value={String(r.salesCount)} />
      </div>

      <div className="rounded-md border divide-y max-w-lg">
        <Row label="Taxable Sales (excl. tax)" value={formatMoney(r.salesSubtotal)} />
        <Row label="Output VAT" value={formatMoney(r.outputTax)} />
        <Row label="Taxable Purchases (excl. tax)" value={formatMoney(r.purchaseSubtotal)} />
        <Row label="Input VAT" value={formatMoney(r.inputTax)} />
        <Row label="Net VAT Payable" value={formatMoney(r.netTax)} bold />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-primary" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between p-4 ${bold ? "font-bold bg-muted/30" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

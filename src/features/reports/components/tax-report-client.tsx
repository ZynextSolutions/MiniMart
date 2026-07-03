"use client";

import type { ReactNode } from "react";
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
    salesGrossSubtotal: number;
    salesDiscount: number;
    salesTaxableBase: number;
    outputTaxSales: number;
    returnGrossSubtotal: number;
    returnDiscount: number;
    returnTaxableBase: number;
    outputTaxReturns: number;
    netTaxableSales: number;
    netOutputTax: number;
    outputByRate: {
      rateKey: string;
      ratePercent: number;
      rateLabel: string;
      salesTaxableBase: number;
      salesTax: number;
      returnTaxableBase: number;
      returnTax: number;
      netTaxableBase: number;
      netOutputTax: number;
    }[];
    salesCount: number;
    returnCount: number;
    invoiceCount: number;
  };
}

export function TaxReportClient(props: TaxReportClientProps) {
  const r = props.report;
  const netPositionLabel = r.netTax >= 0 ? "Net VAT Payable" : "Net VAT Credit";

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
        <StatCard label="Net Output Tax" value={formatMoney(r.netOutputTax)} />
        <StatCard label="Input Tax (Purchases)" value={formatMoney(r.inputTax)} />
        <StatCard label={netPositionLabel} value={formatMoney(Math.abs(r.netTax))} highlight />
        <StatCard label="Total Sales Txn" value={String(r.salesCount + r.returnCount)} />
      </div>

      <div className="rounded-md border divide-y max-w-2xl">
        <Row label="Sales Gross (excl. tax)" value={formatMoney(r.salesGrossSubtotal)} />
        <Row label="Sales Discounts" value={`-${formatMoney(r.salesDiscount)}`} />
        <Row label="Sales Taxable Base" value={formatMoney(r.salesTaxableBase)} />
        <Row label="Output VAT on Sales" value={formatMoney(r.outputTaxSales)} />

        <Row label="Sales Returns Gross (excl. tax)" value={`-${formatMoney(r.returnGrossSubtotal)}`} />
        <Row label="Sales Return Discounts" value={formatMoney(r.returnDiscount)} />
        <Row label="Return Taxable Base Reversal" value={`-${formatMoney(r.returnTaxableBase)}`} />
        <Row label="Output VAT Reversal (Returns)" value={`-${formatMoney(r.outputTaxReturns)}`} />

        <Row label="Net Taxable Sales" value={formatMoney(r.netTaxableSales)} />
        <Row label="Net Output VAT" value={formatMoney(r.netOutputTax)} />
        <Row label="Taxable Purchases (excl. tax)" value={formatMoney(r.purchaseSubtotal)} />
        <Row label="Input VAT" value={formatMoney(r.inputTax)} />
        <Row label={netPositionLabel} value={formatMoney(Math.abs(r.netTax))} bold />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Output VAT Reconciliation by Tax Rate</h3>
        <p className="text-xs text-muted-foreground">
          Sales and sales returns are grouped by tax rate to show net taxable base and net output VAT.
          Input VAT is currently shown as aggregate from supplier invoices.
        </p>
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <Th>Rate</Th>
                <Th right>Sales Base</Th>
                <Th right>Sales VAT</Th>
                <Th right>Return Base</Th>
                <Th right>Return VAT</Th>
                <Th right>Net Base</Th>
                <Th right>Net Output VAT</Th>
              </tr>
            </thead>
            <tbody>
              {r.outputByRate.length === 0 ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={7}>
                    No taxable sales lines in this period.
                  </td>
                </tr>
              ) : (
                r.outputByRate.map((row) => (
                  <tr key={row.rateKey} className="border-t">
                    <Td>{row.rateLabel}</Td>
                    <Td right>{formatMoney(row.salesTaxableBase)}</Td>
                    <Td right>{formatMoney(row.salesTax)}</Td>
                    <Td right>-{formatMoney(row.returnTaxableBase)}</Td>
                    <Td right>-{formatMoney(row.returnTax)}</Td>
                    <Td right>{formatMoney(row.netTaxableBase)}</Td>
                    <Td right>{formatMoney(row.netOutputTax)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th className={`p-3 text-left ${right ? "text-right" : ""}`}>{children}</th>;
}

function Td({ children, right }: { children: ReactNode; right?: boolean }) {
  return <td className={`p-3 ${right ? "text-right" : ""}`}>{children}</td>;
}

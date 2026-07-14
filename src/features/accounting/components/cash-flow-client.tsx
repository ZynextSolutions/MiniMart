"use client";

import { ReportDateFilter } from "./report-date-filter";
import { formatMoney } from "@/lib/utils/format";

interface CashFlowClientProps {
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  from: string;
  to: string;
  defaultBranchId?: string;
  branches?: { id: string; name: string }[];
}

export function CashFlowClient({
  operating,
  investing,
  financing,
  netChange,
  from,
  to,
  defaultBranchId,
  branches,
}: CashFlowClientProps) {
  const rows = [
    { label: "Operating Activities", amount: operating },
    { label: "Investing Activities", amount: investing },
    { label: "Financing Activities", amount: financing },
  ];

  return (
    <div className="space-y-6">
      <ReportDateFilter
        mode="range"
        defaultFrom={from}
        defaultTo={to}
        defaultBranchId={defaultBranchId}
        branches={branches}
      />

      <div className="rounded-md border divide-y max-w-lg">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between p-4">
            <span>{row.label}</span>
            <span className="font-medium">{formatMoney(row.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between p-4 font-bold bg-muted/30">
          <span>Net Change in Cash</span>
          <span className={netChange >= 0 ? "text-green-600" : "text-destructive"}>
            {formatMoney(netChange)}
          </span>
        </div>
      </div>
    </div>
  );
}

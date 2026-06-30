"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportDateFilter } from "./report-date-filter";
import { formatMoney } from "@/lib/utils/format";

interface BalanceSheetClientProps {
  sections: {
    assets: { code: string; name: string; balance: number }[];
    liabilities: { code: string; name: string; balance: number }[];
    equity: { code: string; name: string; balance: number }[];
  };
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  asOf: string;
}

function SectionTable({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { code: string; name: string; balance: number }[];
  total: number;
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <div className="rounded-md border">
        <Table>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.code}>
                <TableCell className="font-mono text-sm w-20">{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell className="text-right">{formatMoney(row.balance)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold bg-muted/50">
              <TableCell colSpan={2}>Total {title}</TableCell>
              <TableCell className="text-right">{formatMoney(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function BalanceSheetClient({
  sections,
  totalAssets,
  totalLiabilities,
  totalEquity,
  totalLiabilitiesAndEquity,
  asOf,
}: BalanceSheetClientProps) {
  return (
    <div className="space-y-6">
      <ReportDateFilter mode="asOf" defaultAsOf={asOf} />
      <SectionTable title="Assets" rows={sections.assets} total={totalAssets} />
      <SectionTable title="Liabilities" rows={sections.liabilities} total={totalLiabilities} />
      <SectionTable title="Equity" rows={sections.equity} total={totalEquity} />
      <div className="rounded-md border p-4 bg-muted/30">
        <div className="flex justify-between font-bold">
          <span>Total Liabilities + Equity</span>
          <span>{formatMoney(totalLiabilitiesAndEquity)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground mt-1">
          <span>Total Assets</span>
          <span>{formatMoney(totalAssets)}</span>
        </div>
      </div>
    </div>
  );
}

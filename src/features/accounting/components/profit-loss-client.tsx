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

interface ProfitLossClientProps {
  revenueRows: { code: string; name: string; amount: number }[];
  expenseRows: { code: string; name: string; amount: number }[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  from: string;
  to: string;
  defaultBranchId?: string;
  branches?: { id: string; name: string }[];
}

export function ProfitLossClient({
  revenueRows,
  expenseRows,
  totalRevenue,
  totalExpenses,
  netIncome,
  from,
  to,
  defaultBranchId,
  branches,
}: ProfitLossClientProps) {
  return (
    <div className="space-y-6">
      <ReportDateFilter
        mode="range"
        defaultFrom={from}
        defaultTo={to}
        defaultBranchId={defaultBranchId}
        branches={branches}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="font-semibold">Revenue</h3>
          <div className="rounded-md border">
            <Table>
              <TableBody>
                {revenueRows.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell className="font-mono text-sm">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={2}>Total Revenue</TableCell>
                  <TableCell className="text-right">{formatMoney(totalRevenue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Expenses</h3>
          <div className="rounded-md border">
            <Table>
              <TableBody>
                {expenseRows.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell className="font-mono text-sm">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={2}>Total Expenses</TableCell>
                  <TableCell className="text-right">{formatMoney(totalExpenses)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div className="rounded-md border p-4 bg-muted/30">
        <div className="flex justify-between font-bold text-lg">
          <span>Net Income</span>
          <span className={netIncome >= 0 ? "text-green-600" : "text-destructive"}>
            {formatMoney(netIncome)}
          </span>
        </div>
      </div>
    </div>
  );
}

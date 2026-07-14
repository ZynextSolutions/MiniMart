"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ReportDateFilter } from "./report-date-filter";
import { formatMoney } from "@/lib/utils/format";

interface TrialBalanceClientProps {
  rows: {
    code: string;
    name: string;
    type: string;
    debit: number;
    credit: number;
  }[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  asOf: string;
  defaultBranchId?: string;
  branches?: { id: string; name: string }[];
}

export function TrialBalanceClient({
  rows,
  totalDebit,
  totalCredit,
  isBalanced,
  asOf,
  defaultBranchId,
  branches,
}: TrialBalanceClientProps) {
  return (
    <div className="space-y-4">
      <ReportDateFilter
        mode="asOf"
        defaultAsOf={asOf}
        defaultBranchId={defaultBranchId}
        branches={branches}
      />

      <div className="flex items-center gap-2">
        <Badge variant={isBalanced ? "default" : "destructive"}>
          {isBalanced ? "Balanced" : "Out of Balance"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Total Debit: {formatMoney(totalDebit)} · Total Credit: {formatMoney(totalCredit)}
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No balances found.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {rows.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell className="font-mono text-sm">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.debit > 0 ? formatMoney(row.debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.credit > 0 ? formatMoney(row.credit) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">{formatMoney(totalDebit)}</TableCell>
                  <TableCell className="text-right">{formatMoney(totalCredit)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

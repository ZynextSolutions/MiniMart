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

interface AgingRow {
  code: string;
  name: string;
  balance: number;
  current: number;
  days31to60: number;
  days61to90: number;
  over90: number;
}

interface AgingReportClientProps {
  title: string;
  rows: AgingRow[];
  total: number;
  asOf: string;
}

export function AgingReportClient({ title, rows, total, asOf }: AgingReportClientProps) {
  return (
    <div className="space-y-4">
      <ReportDateFilter mode="asOf" defaultAsOf={asOf} />

      <p className="text-sm text-muted-foreground">
        Total Outstanding: {formatMoney(total)}
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>{title}</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">31–60</TableHead>
              <TableHead className="text-right">61–90</TableHead>
              <TableHead className="text-right">90+</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No outstanding balances.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.code}>
                  <TableCell className="font-mono text-sm">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right">
                    {row.current > 0 ? formatMoney(row.current) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.days31to60 > 0 ? formatMoney(row.days31to60) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.days61to90 > 0 ? formatMoney(row.days61to90) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.over90 > 0 ? formatMoney(row.over90) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(row.balance)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

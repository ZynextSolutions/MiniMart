"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReportTableProps {
  columns: { header: string; key: string; align?: "left" | "right" }[];
  rows: Record<string, string | number>[];
  emptyMessage?: string;
}

export function ReportTable({ columns, rows, emptyMessage = "No data found." }: ReportTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.align === "right" ? "text-right" : ""}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={col.align === "right" ? "text-right" : ""}
                  >
                    {row[col.key] ?? "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

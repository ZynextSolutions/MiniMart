"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ReportFiltersBar } from "./report-filters-bar";
import { ReportTable } from "./report-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/utils/format";

interface StatementReportClientProps {
  type: "customer" | "supplier";
  entities: { id: string; code: string; name: string }[];
  selectedId?: string;
  from: string;
  to: string;
  statement?: {
    openingBalance: number;
    closingBalance: number;
    entries: { entryDate: Date; description: string; debit: number; credit: number; balance: number }[];
    customer?: { code: string; name: string };
    supplier?: { code: string; name: string };
  } | null;
}

export function StatementReportClient(props: StatementReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityLabel = props.type === "customer" ? "Customer" : "Supplier";
  const paramKey = props.type === "customer" ? "customerId" : "supplierId";

  function onEntityChange(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramKey, id);
    router.push(`?${params.toString()}`);
  }

  const entity = props.statement?.customer ?? props.statement?.supplier;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
        <div className="space-y-1">
          <Label>{entityLabel}</Label>
          <Select value={props.selectedId ?? ""} onValueChange={onEntityChange}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={`Select ${entityLabel.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {props.entities.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.code} — {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ReportFiltersBar mode="range" defaultFrom={props.from} defaultTo={props.to} />

      {entity && props.statement && (
        <>
          <div className="rounded-lg border p-4">
            <p className="font-medium">{entity.code} — {entity.name}</p>
            <div className="mt-2 flex gap-6 text-sm">
              <span>Opening: {formatMoney(props.statement.openingBalance)}</span>
              <span>Closing: {formatMoney(props.statement.closingBalance)}</span>
            </div>
          </div>
          <ReportTable
            columns={[
              { header: "Date", key: "entryDate" },
              { header: "Description", key: "description" },
              { header: "Debit", key: "debit", align: "right" },
              { header: "Credit", key: "credit", align: "right" },
              { header: "Balance", key: "balance", align: "right" },
            ]}
            rows={props.statement.entries.map((e) => ({
              entryDate: new Date(e.entryDate).toLocaleDateString(),
              description: e.description,
              debit: e.debit > 0 ? formatMoney(e.debit) : "—",
              credit: e.credit > 0 ? formatMoney(e.credit) : "—",
              balance: formatMoney(e.balance),
            }))}
            emptyMessage="No ledger entries in this period."
          />
        </>
      )}

      {!props.selectedId && (
        <p className="text-center text-muted-foreground py-8">
          Select a {entityLabel.toLowerCase()} to view their statement.
        </p>
      )}
    </div>
  );
}

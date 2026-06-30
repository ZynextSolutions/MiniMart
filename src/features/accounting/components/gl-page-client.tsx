"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportDateFilter } from "./report-date-filter";
import { formatMoney } from "@/lib/utils/format";

interface GlEntry {
  id: string;
  entryNumber: string;
  entryDate: Date;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface GlPageClientProps {
  accounts: { id: string; code: string; name: string }[];
  entries: GlEntry[];
  selectedAccountId?: string;
  from: string;
  to: string;
}

export function GlPageClient({
  accounts,
  entries,
  selectedAccountId,
  from,
  to,
}: GlPageClientProps) {
  const router = useRouter();

  function onAccountChange(accountId: string) {
    const params = new URLSearchParams({ accountId, from, to });
    router.push(`/accounting/general-ledger?${params.toString()}`);
  }

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Account</label>
          <Select value={selectedAccountId ?? ""} onValueChange={onAccountChange}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ReportDateFilter mode="range" defaultFrom={from} defaultTo={to} />
      </div>

      {selectedAccount && (
        <p className="text-sm text-muted-foreground">
          General Ledger: {selectedAccount.code} — {selectedAccount.name}
        </p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Entry #</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!selectedAccountId ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Select an account to view the general ledger.
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No entries in this period.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{new Date(e.entryDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono text-sm">{e.entryNumber}</TableCell>
                  <TableCell className="max-w-xs truncate">{e.description}</TableCell>
                  <TableCell className="text-right">
                    {e.debit > 0 ? formatMoney(e.debit) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {e.credit > 0 ? formatMoney(e.credit) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(e.balance)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

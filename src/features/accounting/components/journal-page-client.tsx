"use client";

import { useState } from "react";
import { Plus, Check, Ban, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { JournalEntryFormDialog } from "./journal-entry-form-dialog";
import {
  approveJournalAction,
  listJournalEntriesAction,
  voidJournalAction,
} from "@/features/accounting/actions/accounting.actions";
import type { SerializedJournalEntry } from "@/features/accounting/services/accounting-query.service";
import { formatMoney } from "@/lib/utils/format";

interface JournalPageClientProps {
  entries: SerializedJournalEntry[];
  accounts: { id: string; code: string; name: string }[];
}

export function JournalPageClient({ entries: initial, accounts }: JournalPageClientProps) {
  const [entries, setEntries] = useState(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    COMPLETED: "default",
    PENDING: "secondary",
    VOID: "destructive",
    DRAFT: "outline",
  };

  async function refresh() {
    const data = await listJournalEntriesAction({ search: search || undefined });
    setEntries(data);
  }

  async function handleApprove(id: string) {
    const result = await approveJournalAction(id);
    if (result.success) {
      toast.success("Journal entry approved");
      await refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleVoid() {
    if (!voidId) return;
    const result = await voidJournalAction(voidId, "Voided by user");
    if (result.success) {
      toast.success("Journal entry voided");
      await refresh();
    } else {
      toast.error(result.error);
    }
    setVoidId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button variant="outline" onClick={refresh}>
            Search
          </Button>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Manual Entry
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No journal entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
                const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">{entry.entryNumber}</TableCell>
                    <TableCell>{new Date(entry.entryDate).toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.isAutoPosted ? entry.referenceType : "Manual"}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(totalDebit)}</TableCell>
                    <TableCell className="text-right">{formatMoney(totalCredit)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[entry.status] ?? "outline"}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {entry.status === "PENDING" && (
                            <DropdownMenuItem onClick={() => handleApprove(entry.id)}>
                              <Check className="mr-2 h-4 w-4" />
                              Approve
                            </DropdownMenuItem>
                          )}
                          {entry.status === "COMPLETED" && !entry.isAutoPosted && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setVoidId(entry.id)}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Void
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <JournalEntryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        accounts={accounts}
        onSuccess={refresh}
      />

      <ConfirmDialog
        open={!!voidId}
        onOpenChange={(open) => !open && setVoidId(null)}
        title="Void journal entry"
        description="This will create a reversing entry. Auto-posted entries cannot be voided from here."
        confirmLabel="Void"
        variant="destructive"
        onConfirm={handleVoid}
      />
    </div>
  );
}

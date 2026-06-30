"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPettyCashAction,
  recordPettyCashExpenseAction,
} from "@/features/accounting/actions/accounting.actions";
import { formatMoney } from "@/lib/utils/format";

interface PettyCashTransaction {
  id: string;
  entryNumber: string;
  entryDate: Date;
  description: string;
  debit: number;
  credit: number;
}

interface PettyCashPageClientProps {
  balance: number;
  transactions: PettyCashTransaction[];
  expenseAccounts: { id: string; code: string; name: string }[];
}

export function PettyCashPageClient({
  balance: initialBalance,
  transactions: initialTransactions,
  expenseAccounts,
}: PettyCashPageClientProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const data = await getPettyCashAction();
    setBalance(data.balance.balance);
    setTransactions(data.transactions);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await recordPettyCashExpenseAction({
      expenseDate: form.get("expenseDate") as string,
      amount: parseFloat(form.get("amount") as string),
      description: form.get("description") as string,
      expenseAccountId: form.get("expenseAccountId") as string,
    });
    if (result.success) {
      toast.success("Petty cash expense recorded");
      setOpen(false);
      await refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Petty Cash Balance</p>
          <p className="text-3xl font-bold">{formatMoney(balance)}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Record Expense
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Entry #</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No petty cash transactions.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.entryDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono text-sm">{t.entryNumber}</TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell className="text-right">
                    {t.debit > 0 ? formatMoney(t.debit) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.credit > 0 ? formatMoney(t.credit) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Petty Cash Expense</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="expenseDate">Date</Label>
              <Input id="expenseDate" name="expenseDate" type="date" required defaultValue={today} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expenseAccountId">Expense Account</Label>
              <Select name="expenseAccountId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {expenseAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" required rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

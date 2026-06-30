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
import { createExpenseAction, listExpensesAction } from "@/features/accounting/actions/accounting.actions";
import { formatMoney } from "@/lib/utils/format";
import type { PaymentMethod } from "@prisma/client";

interface ExpenseRow {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

interface ExpensesPageClientProps {
  expenses: ExpenseRow[];
  expenseAccounts: { id: string; code: string; name: string }[];
}

export function ExpensesPageClient({ expenses: initial, expenseAccounts }: ExpensesPageClientProps) {
  const [expenses, setExpenses] = useState(initial);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const data = await listExpensesAction();
    setExpenses(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await createExpenseAction({
      expenseDate: form.get("expenseDate") as string,
      accountId: form.get("accountId") as string,
      amount: parseFloat(form.get("amount") as string),
      description: form.get("description") as string,
      paymentMethod: form.get("paymentMethod") as PaymentMethod,
    });
    if (result.success) {
      toast.success("Expense recorded");
      setOpen(false);
      await refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Record Expense
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No expenses recorded.
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-sm">{e.expenseNumber}</TableCell>
                  <TableCell>{new Date(e.expenseDate).toLocaleDateString()}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell>{e.paymentMethod}</TableCell>
                  <TableCell className="text-right">{formatMoney(e.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="expenseDate">Date</Label>
              <Input id="expenseDate" name="expenseDate" type="date" required defaultValue={today} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="accountId">Expense Account</Label>
              <Select name="accountId" required>
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
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select name="paymentMethod" defaultValue="CASH">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                </SelectContent>
              </Select>
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

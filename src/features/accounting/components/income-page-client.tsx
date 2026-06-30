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
import { createIncomeAction, listIncomesAction } from "@/features/accounting/actions/accounting.actions";
import { formatMoney } from "@/lib/utils/format";

interface IncomeRow {
  id: string;
  incomeNumber: string;
  incomeDate: string;
  description: string;
  amount: number;
}

interface IncomePageClientProps {
  incomes: IncomeRow[];
  incomeAccounts: { id: string; code: string; name: string }[];
}

export function IncomePageClient({ incomes: initial, incomeAccounts }: IncomePageClientProps) {
  const [incomes, setIncomes] = useState(initial);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const data = await listIncomesAction();
    setIncomes(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await createIncomeAction({
      incomeDate: form.get("incomeDate") as string,
      accountId: form.get("accountId") as string,
      amount: parseFloat(form.get("amount") as string),
      description: form.get("description") as string,
    });
    if (result.success) {
      toast.success("Income recorded");
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
          Record Income
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incomes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No income recorded.
                </TableCell>
              </TableRow>
            ) : (
              incomes.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-sm">{i.incomeNumber}</TableCell>
                  <TableCell>{new Date(i.incomeDate).toLocaleDateString()}</TableCell>
                  <TableCell>{i.description}</TableCell>
                  <TableCell className="text-right">{formatMoney(i.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Income</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="incomeDate">Date</Label>
              <Input id="incomeDate" name="incomeDate" type="date" required defaultValue={today} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="accountId">Income Account</Label>
              <Select name="accountId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {incomeAccounts.map((a) => (
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

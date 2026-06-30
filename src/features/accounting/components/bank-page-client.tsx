"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createBankAccountAction,
  createBankTransactionAction,
  listBankAccountsAction,
  listBankTransactionsAction,
  reconcileBankTransactionAction,
} from "@/features/accounting/actions/accounting.actions";
import { formatMoney } from "@/lib/utils/format";

interface BankAccountRow {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  currency: string;
  balance: number;
  account: { code: string; name: string };
}

interface BankTransactionRow {
  id: string;
  transactionDate: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  isReconciled: boolean;
}

interface BankPageClientProps {
  bankAccounts: BankAccountRow[];
  transactions: BankTransactionRow[];
  selectedBankAccountId?: string;
}

export function BankPageClient({
  bankAccounts: initialAccounts,
  transactions: initialTransactions,
  selectedBankAccountId,
}: BankPageClientProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selectedId, setSelectedId] = useState(selectedBankAccountId ?? accounts[0]?.id);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function refreshAccounts() {
    const data = await listBankAccountsAction();
    setAccounts(data);
  }

  async function refreshTransactions(bankAccountId: string) {
    const data = await listBankTransactionsAction(bankAccountId);
    setTransactions(data);
  }

  async function selectAccount(id: string) {
    setSelectedId(id);
    await refreshTransactions(id);
  }

  async function handleCreateAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await createBankAccountAction({
      code: form.get("code") as string,
      accountName: form.get("accountName") as string,
      bankName: form.get("bankName") as string,
      accountNumber: form.get("accountNumber") as string,
      currency: form.get("currency") as string,
    });
    if (result.success) {
      toast.success("Bank account created");
      setAccountDialogOpen(false);
      await refreshAccounts();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  async function handleCreateTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await createBankTransactionAction({
      bankAccountId: selectedId,
      transactionDate: form.get("transactionDate") as string,
      description: form.get("description") as string,
      debit: parseFloat(form.get("debit") as string) || 0,
      credit: parseFloat(form.get("credit") as string) || 0,
    });
    if (result.success) {
      toast.success("Transaction recorded");
      setTxnDialogOpen(false);
      await refreshTransactions(selectedId);
      await refreshAccounts();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  async function handleReconcile(id: string) {
    const result = await reconcileBankTransactionAction(id);
    if (result.success) {
      toast.success("Transaction reconciled");
      if (selectedId) await refreshTransactions(selectedId);
    } else {
      toast.error(result.error);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const selectedAccount = accounts.find((a) => a.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <Button
              key={a.id}
              variant={selectedId === a.id ? "default" : "outline"}
              onClick={() => selectAccount(a.id)}
            >
              {a.bankName} ({a.accountNumber})
            </Button>
          ))}
        </div>
        <Button onClick={() => setAccountDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Bank Account
        </Button>
      </div>

      {selectedAccount && (
        <div className="rounded-lg border p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">{selectedAccount.accountName}</p>
            <p className="text-sm text-muted-foreground">
              {selectedAccount.bankName} · {selectedAccount.account.code}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatMoney(selectedAccount.balance)}</p>
            <Button size="sm" className="mt-2" onClick={() => setTxnDialogOpen(true)}>
              <Plus className="mr-1 h-3 w-3" />
              Add Transaction
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No transactions.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.transactionDate).toLocaleDateString()}</TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell className="text-right">
                    {t.debit > 0 ? formatMoney(t.debit) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.credit > 0 ? formatMoney(t.credit) : "—"}
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(t.balance)}</TableCell>
                  <TableCell>
                    <Badge variant={t.isReconciled ? "default" : "secondary"}>
                      {t.isReconciled ? "Reconciled" : "Open"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!t.isReconciled && (
                      <Button variant="ghost" size="sm" onClick={() => handleReconcile(t.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="code">COA Code</Label>
              <Input id="code" name="code" required placeholder="1210" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input id="bankName" name="bankName" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="accountName">Account Name</Label>
              <Input id="accountName" name="accountName" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input id="accountNumber" name="accountNumber" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="THB" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAccountDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={txnDialogOpen} onOpenChange={setTxnDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bank Transaction</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateTransaction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="transactionDate">Date</Label>
              <Input id="transactionDate" name="transactionDate" type="date" required defaultValue={today} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" required rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="debit">Debit (In)</Label>
                <Input id="debit" name="debit" type="number" step="0.01" min="0" defaultValue="0" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="credit">Credit (Out)</Label>
                <Input id="credit" name="credit" type="number" step="0.01" min="0" defaultValue="0" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTxnDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

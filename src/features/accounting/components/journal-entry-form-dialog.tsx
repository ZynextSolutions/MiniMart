"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { createManualJournalAction } from "@/features/accounting/actions/accounting.actions";
import { formatMoney } from "@/lib/utils/format";

interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}

interface JournalEntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: { id: string; code: string; name: string }[];
  onSuccess: () => void;
}

export function JournalEntryFormDialog({
  open,
  onOpenChange,
  accounts,
  onSuccess,
}: JournalEntryFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: "", debit: 0, credit: 0, description: "" },
    { accountId: "", debit: 0, credit: 0, description: "" },
  ]);

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  function updateLine(index: number, field: keyof JournalLine, value: string | number) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { accountId: "", debit: 0, credit: 0, description: "" }]);
  }

  function removeLine(index: number) {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isBalanced) {
      toast.error("Journal entry must balance");
      return;
    }
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const result = await createManualJournalAction({
      entryDate: form.get("entryDate") as string,
      description: form.get("description") as string,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        description: l.description || undefined,
      })),
      autoApprove: form.get("autoApprove") === "true",
    });

    if (result.success) {
      toast.success("Journal entry created");
      onSuccess();
      onOpenChange(false);
      setLines([
        { accountId: "", debit: 0, credit: 0, description: "" },
        { accountId: "", debit: 0, credit: 0, description: "" },
      ]);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manual Journal Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="entryDate">Entry Date</Label>
              <Input id="entryDate" name="entryDate" type="date" required defaultValue={today} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="autoApprove">Approval</Label>
              <Select name="autoApprove" defaultValue="false">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Submit for approval</SelectItem>
                  <SelectItem value="true">Post immediately</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" required rows={2} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Journal Lines</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-3 w-3" />
                Add Line
              </Button>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Select
                    value={line.accountId}
                    onValueChange={(v) => updateLine(index, "accountId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Account" />
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
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Debit"
                    value={line.debit || ""}
                    onChange={(e) => updateLine(index, "debit", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Credit"
                    value={line.credit || ""}
                    onChange={(e) => updateLine(index, "credit", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    placeholder="Memo"
                    value={line.description}
                    onChange={(e) => updateLine(index, "description", e.target.value)}
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(index)}
                    disabled={lines.length <= 2}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-4 text-sm">
              <span>Debit: {formatMoney(totalDebit)}</span>
              <span>Credit: {formatMoney(totalCredit)}</span>
              <span className={isBalanced ? "text-green-600" : "text-destructive"}>
                {isBalanced ? "Balanced" : "Out of balance"}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !isBalanced}>
              Create Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

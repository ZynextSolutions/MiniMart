"use client";

import { useState } from "react";
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
import {
  createAccountAction,
  updateAccountAction,
} from "@/features/accounting/actions/accounting.actions";
import type { AccountTreeNode } from "@/features/accounting/services/accounting-query.service";
import type { AccountSubtype, AccountType } from "@prisma/client";

const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

const ACCOUNT_SUBTYPES: AccountSubtype[] = [
  "OTHER",
  "CASH",
  "BANK",
  "PETTY_CASH",
  "ACCOUNTS_RECEIVABLE",
  "INVENTORY",
  "FIXED_ASSET",
  "ACCUMULATED_DEPRECIATION",
  "ACCOUNTS_PAYABLE",
  "SALES_TAX_PAYABLE",
  "RETAINED_EARNINGS",
  "SALES_REVENUE",
  "COGS",
];

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountTreeNode | null;
  parentOptions: { id: string; code: string; name: string }[];
  onSuccess: () => void;
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  parentOptions,
  onSuccess,
}: AccountFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<AccountType>(account?.type ?? "EXPENSE");
  const [subtype, setSubtype] = useState<AccountSubtype>(
    (account?.subtype as AccountSubtype) ?? "OTHER",
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    if (account) {
      const result = await updateAccountAction({
        id: account.id,
        name: form.get("name") as string,
        description: (form.get("description") as string) || undefined,
        isActive: form.get("isActive") === "true",
        parentId: (form.get("parentId") as string) || null,
      });
      if (result.success) {
        toast.success("Account updated");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await createAccountAction({
        code: form.get("code") as string,
        name: form.get("name") as string,
        type,
        subtype,
        parentId: (form.get("parentId") as string) || undefined,
        description: (form.get("description") as string) || undefined,
      });
      if (result.success) {
        toast.success("Account created");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? "Edit Account" : "New Account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!account && (
            <div className="space-y-1">
              <Label htmlFor="code">Account Code</Label>
              <Input id="code" name="code" required placeholder="e.g. 5210" />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required defaultValue={account?.name} />
          </div>
          {!account && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Subtype</Label>
                <Select value={subtype} onValueChange={(v) => setSubtype(v as AccountSubtype)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_SUBTYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="parentId">Parent Account</Label>
            <Select name="parentId" defaultValue={account?.parentId ?? ""}>
              <SelectTrigger>
                <SelectValue placeholder="None (top level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (top level)</SelectItem>
                {parentOptions
                  .filter((p) => p.id !== account?.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          {account && (
            <div className="space-y-1">
              <Label htmlFor="isActive">Status</Label>
              <Select name="isActive" defaultValue={account.isActive ? "true" : "false"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {account ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { issueGiftCardAction } from "@/features/gift-cards/actions/gift-card.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type GiftCard = {
  id: string;
  code: string;
  balance: string;
  isActive: boolean;
  expiresAt: string | null;
  customer: { name: string; code: string } | null;
};

export function GiftCardsClient({
  cards,
  customers,
}: {
  cards: GiftCard[];
  customers: { id: string; name: string; code: string }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleIssue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const result = await issueGiftCardAction({
      customerId: String(form.get("customerId")),
      initialBalance: Number(form.get("initialBalance")),
      expiresAt: String(form.get("expiresAt") || ""),
    });
    setSaving(false);
    if (result.success) {
      toast.success(`Gift card issued: ${result.code}`);
      router.refresh();
    } else toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Issue Gift Card</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleIssue} className="grid gap-3 sm:grid-cols-4">
            <select name="customerId" className="h-10 rounded-md border px-3 text-sm" required>
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
            <Input name="initialBalance" type="number" placeholder="Amount" required />
            <Input name="expiresAt" type="date" />
            <Button type="submit" disabled={saving}>Issue card</Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map((card) => (
              <TableRow key={card.id}>
                <TableCell className="font-mono">{card.code}</TableCell>
                <TableCell>{card.customer?.name ?? "—"}</TableCell>
                <TableCell>{card.balance}</TableCell>
                <TableCell>{card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : "—"}</TableCell>
                <TableCell>{card.isActive ? "Yes" : "No"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

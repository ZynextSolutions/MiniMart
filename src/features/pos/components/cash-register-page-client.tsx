"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils/format";
import {
  closeRegisterSessionAction,
  getRegisterSessionSummaryAction,
} from "@/features/pos/actions/pos.actions";

interface CashRegisterPageClientProps {
  session: {
    id: string;
    status: string;
    openingBalance: string;
    openedAt: string;
    cashRegister: { name: string; code: string };
  } | null;
}

export function CashRegisterPageClient({ session }: CashRegisterPageClientProps) {
  const [closingBalance, setClosingBalance] = useState("");
  const [summary, setSummary] = useState<{
    transactionCount: number;
    totalSales: number;
    returnTotal: number;
    netSales: number;
    cashTotal: number;
    cashRefundTotal: number;
    netCash: number;
    expectedCash: number;
  } | null>(null);
  const [closing, setClosing] = useState(false);

  async function loadSummary() {
    if (!session) return;
    const data = await getRegisterSessionSummaryAction(session.id);
    setSummary({
      transactionCount: data.transactionCount,
      totalSales: data.totalSales,
      returnTotal: data.returnTotal,
      netSales: data.netSales,
      cashTotal: data.cashTotal,
      cashRefundTotal: data.cashRefundTotal,
      netCash: data.netCash,
      expectedCash: data.expectedCash,
    });
  }

  async function handleClose() {
    if (!session) return;
    setClosing(true);
    const result = await closeRegisterSessionAction(
      session.id,
      parseFloat(closingBalance) || 0,
    );
    setClosing(false);
    if (result.success) {
      toast.success("Register closed");
      window.location.reload();
    } else {
      toast.error(result.error);
    }
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No open register session. Open a register from the POS terminal.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cash Register</h1>
          <p className="text-muted-foreground">
            {session.cashRegister.code} — {session.cashRegister.name}
          </p>
        </div>
        <Badge>{session.status}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Opening Balance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatMoney(session.openingBalance)}
          </CardContent>
        </Card>
        {summary && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Gross Sales</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {formatMoney(summary.totalSales)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sales Returns</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-amber-600">
                -{formatMoney(summary.returnTotal)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Net Sales</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {formatMoney(summary.netSales)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Expected Drawer Cash</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {formatMoney(summary.expectedCash)}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={loadSummary}>
          Refresh Summary
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Close Register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label>Counted Cash in Drawer</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
            />
          </div>
          <Button onClick={handleClose} disabled={closing}>
            {closing ? "Closing..." : "Close Register"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

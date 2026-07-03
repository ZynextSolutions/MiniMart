"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/utils/format";
import { calculateChange } from "@/lib/services/pos-calculation";
import { completeSaleAction } from "@/features/pos/actions/pos.actions";
import { usePosCartStore } from "@/features/pos/stores/pos-cart-store";
import type { PaymentMethod } from "@prisma/client";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  sessionId: string;
  cashRegisterId: string;
  onComplete: (saleId: string) => void;
}

type PayMode = "CASH" | "CARD" | "QR" | "BANK_TRANSFER" | "CREDIT" | "MIXED";

export function PaymentDialog({
  open,
  onOpenChange,
  warehouseId,
  sessionId,
  cashRegisterId,
  onComplete,
}: PaymentDialogProps) {
  const cart = usePosCartStore();
  const [mode, setMode] = useState<PayMode>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      idempotencyKeyRef.current = `sale-${crypto.randomUUID()}`;
    } else {
      idempotencyKeyRef.current = null;
    }
  }, [open]);

  const grandTotal = cart.grandTotal;
  const change =
    mode === "CASH" && cashReceived
      ? calculateChange(parseFloat(cashReceived) || 0, grandTotal)
      : 0;

  async function handleComplete() {
    if (submitting) return;
    setSubmitting(true);

    const idempotencyKey = idempotencyKeyRef.current;
    if (!idempotencyKey) {
      toast.error("Payment session expired. Close and reopen the dialog.");
      setSubmitting(false);
      return;
    }

    const payments: { method: PaymentMethod; amount: number; reference?: string }[] = [];
    let cashReceivedAmount: number | undefined;

    if (mode === "CASH") {
      const received = parseFloat(cashReceived) || grandTotal;
      if (received < grandTotal) {
        toast.error("Insufficient cash received");
        setSubmitting(false);
        return;
      }
      cashReceivedAmount = received;
      payments.push({ method: "CASH", amount: grandTotal });
    } else if (mode === "MIXED") {
      const cash = parseFloat(cashReceived) || 0;
      const card = parseFloat(cardAmount) || 0;
      if (Math.abs(cash + card - grandTotal) > 0.02) {
        toast.error("Payment amounts must equal total");
        setSubmitting(false);
        return;
      }
      if (cash > 0) payments.push({ method: "CASH", amount: cash });
      if (card > 0) payments.push({ method: "CARD", amount: card, reference });
    } else {
      if ((mode === "QR" || mode === "BANK_TRANSFER") && !reference) {
        toast.error("Reference required");
        setSubmitting(false);
        return;
      }
      payments.push({ method: mode, amount: grandTotal, reference: reference || undefined });
    }

    const result = await completeSaleAction({
      warehouseId,
      sessionId,
      cashRegisterId,
      customerId: cart.customerId ?? undefined,
      couponCode: cart.couponCode ?? undefined,
      orderDiscount: cart.orderDiscount,
      lines: cart.items.map((i) => ({
        variantId: i.variantId,
        productName: i.productName,
        sku: i.sku,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        taxRateId: i.taxRateId,
        taxRate: i.taxRate,
        lineDiscount: i.lineDiscount,
        costPrice: i.costPrice,
      })),
      payments,
      cashReceived: cashReceivedAmount,
      idempotencyKey,
    });

    setSubmitting(false);

    if (result.success && result.saleId) {
      toast.success("Sale completed");
      cart.clear();
      onOpenChange(false);
      onComplete(result.saleId);
    } else {
      toast.error(result.error ?? "Sale failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment — {formatMoney(grandTotal)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as PayMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
                <SelectItem value="QR">QR Payment</SelectItem>
                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                <SelectItem value="CREDIT">Credit (AR)</SelectItem>
                <SelectItem value="MIXED">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "CASH" && (
            <div className="space-y-2">
              <Label>Cash Received</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder={grandTotal.toFixed(2)}
                autoFocus
              />
              {change > 0 && (
                <p className="text-lg font-semibold text-green-600">
                  Change: {formatMoney(change)}
                </p>
              )}
            </div>
          )}

          {mode === "MIXED" && (
            <>
              <div className="space-y-2">
                <Label>Cash Amount</Label>
                <Input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Card Amount</Label>
                <Input
                  type="number"
                  value={cardAmount}
                  onChange={(e) => setCardAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Card Reference</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </>
          )}

          {(mode === "CARD" || mode === "QR" || mode === "BANK_TRANSFER") && (
            <div className="space-y-2">
              <Label>Reference {mode !== "CARD" ? "(required)" : "(optional)"}</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={submitting}>
            {submitting ? "Processing..." : "Complete Sale (F5)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

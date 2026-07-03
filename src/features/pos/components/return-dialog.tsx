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
import { processReturnAction } from "@/features/pos/actions/pos.actions";
import type { PaymentMethod } from "@prisma/client";

interface ReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  sessionId: string;
  cashRegisterId: string;
  onComplete: (saleId: string) => void;
}

export function ReturnDialog({
  open,
  onOpenChange,
  warehouseId,
  sessionId,
  cashRegisterId,
  onComplete,
}: ReturnDialogProps) {
  type RefundMethod = "CASH" | "CARD" | "QR" | "BANK_TRANSFER";
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [sale, setSale] = useState<{
    id: string;
    lines: {
      id: string;
      variantId: string;
      productName: string;
      sku: string;
      quantity: { toString(): string };
      unitPrice: { toString(): string };
      taxAmount: { toString(): string };
      lineTotal: { toString(): string };
      costPrice: { toString(): string };
      taxRateId: string | null;
    }[];
    payments: { method: PaymentMethod }[];
  } | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const [refundReference, setRefundReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      idempotencyKeyRef.current = `return-${crypto.randomUUID()}`;
    } else {
      idempotencyKeyRef.current = null;
    }
  }, [open]);

  const refundAmount = sale
    ? sale.lines.reduce((sum, line) => {
        const qty = quantities[line.id] ?? 0;
        if (qty <= 0) return sum;
        const perQty = Number(line.quantity) > 0 ? Number(line.lineTotal) / Number(line.quantity) : 0;
        return sum + perQty * qty;
      }, 0)
    : 0;

  async function handleLookup() {
    setLoading(true);
    try {
      const sales = await fetch(`/api/v1/pos/sales?invoice=${encodeURIComponent(invoiceNumber)}`);
      if (!sales.ok) {
        toast.error("Sale not found");
        return;
      }
      const data = await sales.json();
      const preferredMethod = (() => {
        const original = data.payments?.[0]?.method as PaymentMethod | undefined;
        if (
          original === "CASH" ||
          original === "CARD" ||
          original === "QR" ||
          original === "BANK_TRANSFER"
        ) {
          return original;
        }
        return "CASH";
      })();
      setSale(data);
      setRefundMethod(preferredMethod);
      setRefundReference("");
      setQuantities(
        Object.fromEntries(data.lines.map((l: { id: string }) => [l.id, 0])),
      );
    } catch {
      toast.error("Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleReturn() {
    if (!sale) return;
    const idempotencyKey = idempotencyKeyRef.current;
    if (!idempotencyKey) {
      toast.error("Return session expired. Close and reopen the dialog.");
      return;
    }

    const lines = sale.lines
      .filter((l) => (quantities[l.id] ?? 0) > 0)
      .map((l) => ({
        variantId: l.variantId,
        quantity: quantities[l.id],
        unitPrice: Number(l.unitPrice),
        taxRate: Number(l.taxAmount) > 0 && Number(l.unitPrice) > 0
          ? (Number(l.taxAmount) / Number(l.quantity) / Number(l.unitPrice)) * 100
          : 0,
        productName: l.productName,
        sku: l.sku,
        costPrice: Number(l.costPrice),
      }));

    if (lines.length === 0) {
      toast.error("Select items to return");
      return;
    }

    if ((refundMethod === "QR" || refundMethod === "BANK_TRANSFER") && !refundReference.trim()) {
      toast.error("Refund reference required");
      return;
    }

    setSubmitting(true);
    const result = await processReturnAction({
      originalSaleId: sale.id,
      warehouseId,
      sessionId,
      cashRegisterId,
      lines,
      payments: [{
        method: refundMethod,
        amount: refundAmount,
        reference: refundReference.trim() || undefined,
      }],
      idempotencyKey,
    });
    setSubmitting(false);

    if (result.success && result.saleId) {
      toast.success("Return processed");
      onOpenChange(false);
      onComplete(result.saleId);
      setSale(null);
      setInvoiceNumber("");
    } else {
      toast.error(result.error ?? "Return failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Return / Refund</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="Invoice number e.g. INV-2026-00001"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
          <Button onClick={handleLookup} disabled={loading}>
            {loading ? "..." : "Find"}
          </Button>
        </div>

        {sale && (
          <div className="space-y-3">
            <div className="space-y-2 max-h-56 overflow-auto">
              {sale.lines.map((line) => (
                <div key={line.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                  <div>
                    <p className="font-medium">{line.productName}</p>
                    <p className="text-muted-foreground">
                      Sold: {Number(line.quantity)} · {formatMoney(Number(line.unitPrice))}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    max={Number(line.quantity)}
                    className="w-20"
                    value={quantities[line.id] ?? 0}
                    onChange={(e) =>
                      setQuantities({ ...quantities, [line.id]: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Refund Method</Label>
                <Select value={refundMethod} onValueChange={(value) => setRefundMethod(value as RefundMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="QR">QR</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(refundMethod === "CARD" || refundMethod === "QR" || refundMethod === "BANK_TRANSFER") && (
                <div className="space-y-1">
                  <Label>
                    Reference {(refundMethod === "QR" || refundMethod === "BANK_TRANSFER") ? "(required)" : "(optional)"}
                  </Label>
                  <Input value={refundReference} onChange={(e) => setRefundReference(e.target.value)} />
                </div>
              )}
            </div>

            <p className="text-sm font-medium">
              Refund Amount: {formatMoney(refundAmount)}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleReturn} disabled={!sale || submitting}>
            {submitting ? "Processing..." : "Process Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
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
import { formatMoney } from "@/lib/utils/format";
import { processReturnAction } from "@/features/pos/actions/pos.actions";

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
      costPrice: { toString(): string };
      taxRateId: string | null;
    }[];
  } | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleLookup() {
    setLoading(true);
    try {
      const sales = await fetch(`/api/v1/pos/sales?invoice=${encodeURIComponent(invoiceNumber)}`);
      if (!sales.ok) {
        toast.error("Sale not found");
        return;
      }
      const data = await sales.json();
      setSale(data);
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

    const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

    setSubmitting(true);
    const result = await processReturnAction({
      originalSaleId: sale.id,
      warehouseId,
      sessionId,
      cashRegisterId,
      lines,
      payments: [{ method: "CASH", amount: total }],
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
          <div className="space-y-2 max-h-60 overflow-auto">
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

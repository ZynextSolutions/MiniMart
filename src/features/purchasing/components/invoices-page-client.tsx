"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/utils/format";
import {
  createSupplierInvoiceAction,
  getGoodsReceiptForInvoicingAction,
  listInvoiceableGoodsReceiptsAction,
  recordSupplierPaymentAction,
} from "@/features/purchasing/actions/purchasing.actions";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  varianceAmount: number;
  goodsReceiptNumber?: string | null;
  supplier: { id: string; name: string };
}

interface InvoicesPageClientProps {
  invoices: InvoiceRow[];
  suppliers: { id: string; name: string; code: string }[];
}

interface InvoiceableReceipt {
  id: string;
  receiptNumber: string;
  receiptDate: Date;
  purchaseOrder: {
    orderNumber: string;
    supplier: { id: string; name: string };
  } | null;
  lines: {
    id: string;
    variantId: string;
    remainingQty: number;
    unitCost: number;
    variant?: {
      sku: string;
      product: { name: string };
    };
  }[];
}

interface LineItem {
  goodsReceiptLineId: string;
  variantId: string;
  label: string;
  quantity: number;
  grnUnitCost: number;
  unitCost: number;
}

export function InvoicesPageClient({ invoices, suppliers }: InvoicesPageClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [payDialog, setPayDialog] = useState<InvoiceRow | null>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [goodsReceiptId, setGoodsReceiptId] = useState("");
  const [invoiceableReceipts, setInvoiceableReceipts] = useState<InvoiceableReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "BANK">("BANK");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !supplierId) {
      setInvoiceableReceipts([]);
      return;
    }

    setLoadingReceipts(true);
    listInvoiceableGoodsReceiptsAction(supplierId)
      .then((receipts) => {
        setInvoiceableReceipts(receipts as InvoiceableReceipt[]);
      })
      .finally(() => setLoadingReceipts(false));
  }, [open, supplierId]);

  useEffect(() => {
    if (!goodsReceiptId) {
      setLines([]);
      return;
    }

    getGoodsReceiptForInvoicingAction(goodsReceiptId).then((receipt) => {
      if (!receipt) {
        setLines([]);
        return;
      }

      setLines(
        receipt.lines.map((line) => ({
          goodsReceiptLineId: line.id,
          variantId: line.variantId,
          label: `${line.variant?.product.name ?? "Product"} (${line.variant?.sku ?? ""})`,
          quantity: line.remainingQty,
          grnUnitCost: line.unitCost,
          unitCost: line.unitCost,
        })),
      );
    });
  }, [goodsReceiptId]);

  const totals = useMemo(() => {
    const grnSubtotal = lines.reduce((sum, l) => sum + l.quantity * l.grnUnitCost, 0);
    const invoiceSubtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
    return {
      grnSubtotal,
      invoiceSubtotal,
      variance: invoiceSubtotal - grnSubtotal,
    };
  }, [lines]);

  async function handleCreate() {
    if (!supplierId || !goodsReceiptId || lines.length === 0) return;
    setSubmitting(true);
    const result = await createSupplierInvoiceAction({
      supplierId,
      goodsReceiptId,
      invoiceDate,
      dueDate,
      lines: lines.map((l) => ({
        goodsReceiptLineId: l.goodsReceiptLineId,
        variantId: l.variantId,
        quantity: l.quantity,
        unitCost: l.unitCost,
      })),
    });
    setSubmitting(false);
    if (result.success) {
      toast.success("Invoice created and reconciled with goods receipt");
      setOpen(false);
      setGoodsReceiptId("");
      setLines([]);
      router.refresh();
    } else toast.error(result.error);
  }

  async function handlePay() {
    if (!payDialog) return;
    const amount = parseFloat(payAmount);
    const result = await recordSupplierPaymentAction({
      supplierId: payDialog.supplier.id,
      invoiceId: payDialog.id,
      amount,
      paymentDate: new Date().toISOString().slice(0, 10),
      method: payMethod,
    });
    if (result.success) {
      toast.success("Payment recorded");
      setPayDialog(null);
      router.refresh();
    } else toast.error(result.error);
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>GRN</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Variance</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const outstanding = inv.totalAmount - inv.paidAmount;
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.goodsReceiptNumber ?? "—"}</TableCell>
                  <TableCell>{inv.supplier.name}</TableCell>
                  <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>{formatMoney(inv.totalAmount)}</TableCell>
                  <TableCell>
                    {inv.varianceAmount !== 0 ? (
                      <span className={inv.varianceAmount > 0 ? "text-amber-600" : "text-emerald-600"}>
                        {formatMoney(inv.varianceAmount)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{formatMoney(inv.paidAmount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{inv.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {outstanding > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPayDialog(inv);
                          setPayAmount(outstanding.toFixed(2));
                        }}
                      >
                        Pay
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Supplier Invoice from Goods Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select
                  value={supplierId}
                  onValueChange={(value) => {
                    setSupplierId(value);
                    setGoodsReceiptId("");
                    setLines([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Goods Receipt</Label>
                <Select
                  value={goodsReceiptId}
                  onValueChange={setGoodsReceiptId}
                  disabled={loadingReceipts || invoiceableReceipts.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingReceipts ? "Loading..." : "Select GRN"} />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceableReceipts.map((receipt) => (
                      <SelectItem key={receipt.id} value={receipt.id}>
                        {receipt.receiptNumber}
                        {receipt.purchaseOrder ? ` — ${receipt.purchaseOrder.orderNumber}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            {lines.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">GRN Cost</TableHead>
                      <TableHead className="text-right">Invoice Cost</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, i) => {
                      const variance = l.quantity * (l.unitCost - l.grnUnitCost);
                      return (
                        <TableRow key={l.goodsReceiptLineId}>
                          <TableCell>{l.label}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="ml-auto w-20"
                              value={l.quantity}
                              onChange={(e) =>
                                setLines(
                                  lines.map((x, idx) =>
                                    idx === i
                                      ? { ...x, quantity: parseFloat(e.target.value) || 0 }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">{formatMoney(l.grnUnitCost)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="ml-auto w-24"
                              value={l.unitCost}
                              onChange={(e) =>
                                setLines(
                                  lines.map((x, idx) =>
                                    idx === i
                                      ? { ...x, unitCost: parseFloat(e.target.value) || 0 }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {variance !== 0 ? formatMoney(variance) : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {lines.length > 0 && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span>GRN subtotal</span>
                  <span>{formatMoney(totals.grnSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Invoice subtotal</span>
                  <span>{formatMoney(totals.invoiceSubtotal)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Price variance</span>
                  <span>{formatMoney(totals.variance)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={submitting || !goodsReceiptId || lines.length === 0}
            >
              Create & Reconcile AP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <Select value={payMethod} onValueChange={(v) => setPayMethod(v as "CASH" | "BANK")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handlePay}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
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
import { PurchaseVariantSearch, type PurchaseVariantOption } from "./purchase-variant-search";
import {
  createSupplierInvoiceAction,
  recordSupplierPaymentAction,
} from "@/features/purchasing/actions/purchasing.actions";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  status: string;
  totalAmount: { toString(): string };
  paidAmount: { toString(): string };
  supplier: { id: string; name: string };
}

interface InvoicesPageClientProps {
  invoices: InvoiceRow[];
  suppliers: { id: string; name: string; code: string }[];
}

interface LineItem {
  variantId: string;
  label: string;
  quantity: number;
  unitCost: number;
}

export function InvoicesPageClient({ invoices, suppliers }: InvoicesPageClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [payDialog, setPayDialog] = useState<InvoiceRow | null>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "BANK">("BANK");

  function addVariant(v: PurchaseVariantOption) {
    setLines([
      ...lines,
      {
        variantId: v.id,
        label: `${v.product.name} (${v.sku})`,
        quantity: 1,
        unitCost: Number(v.costPrice),
      },
    ]);
  }

  async function handleCreate() {
    const result = await createSupplierInvoiceAction({
      supplierId,
      invoiceDate,
      dueDate,
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost })),
    });
    if (result.success) {
      toast.success("Invoice created");
      setOpen(false);
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
              <TableHead>Supplier</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.supplier.name}</TableCell>
                  <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>{formatMoney(Number(inv.totalAmount))}</TableCell>
                  <TableCell>{formatMoney(Number(inv.paidAmount))}</TableCell>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supplier Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={supplierId} onValueChange={setSupplierId}>
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
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <PurchaseVariantSearch onSelect={addVariant} />
            {lines.map((l, i) => (
              <div key={l.variantId} className="flex gap-2 text-sm">
                <span className="flex-1">{l.label}</span>
                <Input type="number" className="w-20" value={l.quantity} onChange={(e) =>
                  setLines(lines.map((x, idx) => idx === i ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x))
                } />
                <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={lines.length === 0}>
              Create & Post AP
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

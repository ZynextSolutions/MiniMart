"use client";

import { useState } from "react";
import Link from "next/link";
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
  createPurchaseOrderAction,
  submitPurchaseOrderAction,
  approvePurchaseOrderAction,
} from "@/features/purchasing/actions/purchasing.actions";

interface OrderRow {
  id: string;
  orderNumber: string;
  orderDate: Date;
  status: string;
  totalAmount: { toString(): string };
  supplier: { name: string; code: string };
  _count: { lines: number };
}

interface OrdersPageClientProps {
  orders: OrderRow[];
  suppliers: { id: string; name: string; code: string }[];
}

interface LineItem {
  variantId: string;
  label: string;
  quantity: number;
  unitCost: number;
}

export function OrdersPageClient({ orders, suppliers }: OrdersPageClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function addVariant(v: PurchaseVariantOption) {
    if (lines.some((l) => l.variantId === v.id)) return;
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
    if (!supplierId || lines.length === 0) return;
    setSubmitting(true);
    const result = await createPurchaseOrderAction({
      supplierId,
      orderDate,
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost })),
    });
    setSubmitting(false);
    if (result.success) {
      toast.success("PO created");
      setOpen(false);
      setLines([]);
      router.refresh();
    } else toast.error(result.error);
  }

  async function handleAction(action: "submit" | "approve", id: string) {
    const result =
      action === "submit" ? await submitPurchaseOrderAction(id) : await approvePurchaseOrderAction(id);
    if (result.success) {
      toast.success(action === "submit" ? "Submitted" : "Approved");
      router.refresh();
    } else toast.error(result.error);
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New PO
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link href={`/purchasing/orders/${o.id}`} className="font-medium hover:underline">
                    {o.orderNumber}
                  </Link>
                </TableCell>
                <TableCell>{o.supplier.name}</TableCell>
                <TableCell>{new Date(o.orderDate).toLocaleDateString()}</TableCell>
                <TableCell>{formatMoney(Number(o.totalAmount))}</TableCell>
                <TableCell>
                  <Badge variant="outline">{o.status}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {o.status === "DRAFT" && (
                    <Button size="sm" variant="secondary" onClick={() => handleAction("submit", o.id)}>
                      Submit
                    </Button>
                  )}
                  {o.status === "PENDING" && (
                    <Button size="sm" onClick={() => handleAction("approve", o.id)}>
                      Approve
                    </Button>
                  )}
                  {o.status === "APPROVED" && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/purchasing/receiving?po=${o.id}`}>Receive</Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            <PurchaseVariantSearch onSelect={addVariant} />
            {lines.map((l, i) => (
              <div key={l.variantId} className="flex gap-2 text-sm">
                <span className="flex-1 truncate">{l.label}</span>
                <Input
                  type="number"
                  className="w-20"
                  value={l.quantity}
                  onChange={(e) =>
                    setLines(lines.map((x, idx) => (idx === i ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x)))
                  }
                />
                <Input
                  type="number"
                  className="w-24"
                  value={l.unitCost}
                  onChange={(e) =>
                    setLines(lines.map((x, idx) => (idx === i ? { ...x, unitCost: parseFloat(e.target.value) || 0 } : x)))
                  }
                />
                <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={submitting || lines.length === 0}>
              Create PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

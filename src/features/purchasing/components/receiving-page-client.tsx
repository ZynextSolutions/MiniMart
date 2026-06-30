"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PurchaseVariantSearch, type PurchaseVariantOption } from "./purchase-variant-search";
import { createGoodsReceiptAction, getPurchaseOrderAction } from "@/features/purchasing/actions/purchasing.actions";

interface ReceiptRow {
  id: string;
  receiptNumber: string;
  receiptDate: Date;
  status: string;
  purchaseOrder: { orderNumber: string } | null;
  _count: { lines: number };
}

interface ReceivingPageClientProps {
  receipts: ReceiptRow[];
  warehouses: { id: string; name: string; code: string }[];
  approvedOrders: { id: string; orderNumber: string; supplier: { name: string } }[];
}

interface LineItem {
  variantId: string;
  label: string;
  quantity: number;
  unitCost: number;
}

export function ReceivingPageClient({
  receipts,
  warehouses,
  approvedOrders,
}: ReceivingPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poFromUrl = searchParams.get("po");

  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [purchaseOrderId, setPurchaseOrderId] = useState(poFromUrl ?? "");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (poFromUrl) {
      getPurchaseOrderAction(poFromUrl).then((po) => {
        if (po?.lines) {
          setLines(
            po.lines.map((l) => ({
              variantId: l.variantId,
              label: `${l.variant?.product.name ?? ""} (${l.variant?.sku ?? ""})`,
              quantity: Number(l.quantity) - Number(l.receivedQty),
              unitCost: Number(l.unitCost),
            })).filter((l) => l.quantity > 0),
          );
        }
      });
    }
  }, [poFromUrl]);

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

  async function handleReceive() {
    if (!warehouseId || lines.length === 0) return;
    setSubmitting(true);
    const result = await createGoodsReceiptAction({
      warehouseId,
      purchaseOrderId: purchaseOrderId || undefined,
      receiptDate,
      lines: lines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        unitCost: l.unitCost,
      })),
    });
    setSubmitting(false);
    if (result.success) {
      toast.success(`Received ${result.receipt?.receiptNumber}`);
      setLines([]);
      router.refresh();
    } else toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-medium">Receive Goods</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Purchase Order (optional)</Label>
            <Select value={purchaseOrderId || "none"} onValueChange={(v) => setPurchaseOrderId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No PO" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No PO</SelectItem>
                {approvedOrders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.orderNumber} — {o.supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Receipt Date</Label>
            <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
          </div>
        </div>
        <PurchaseVariantSearch onSelect={addVariant} />
        {lines.map((l, i) => (
          <div key={`${l.variantId}-${i}`} className="flex gap-2 text-sm">
            <span className="flex-1">{l.label}</span>
            <Input
              type="number"
              className="w-24"
              value={l.quantity}
              onChange={(e) =>
                setLines(lines.map((x, idx) => (idx === i ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x)))
              }
            />
            <Input
              type="number"
              className="w-28"
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
        <Button onClick={handleReceive} disabled={submitting || lines.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          {submitting ? "Receiving..." : "Complete Receipt"}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GRN #</TableHead>
              <TableHead>PO</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.receiptNumber}</TableCell>
                <TableCell>{r.purchaseOrder?.orderNumber ?? "—"}</TableCell>
                <TableCell>{new Date(r.receiptDate).toLocaleDateString()}</TableCell>
                <TableCell>{r._count.lines}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

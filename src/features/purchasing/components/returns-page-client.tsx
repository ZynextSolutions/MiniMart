"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PurchaseVariantSearch, type PurchaseVariantOption } from "./purchase-variant-search";
import { createSupplierReturnAction } from "@/features/purchasing/actions/purchasing.actions";

interface ReturnsPageClientProps {
  suppliers: { id: string; name: string; code: string }[];
  warehouses: { id: string; name: string; code: string }[];
}

interface LineItem {
  variantId: string;
  label: string;
  quantity: number;
  unitCost: number;
}

export function ReturnsPageClient({ suppliers, warehouses }: ReturnsPageClientProps) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleReturn() {
    if (!supplierId || !warehouseId || lines.length === 0) return;
    setSubmitting(true);
    const result = await createSupplierReturnAction({
      supplierId,
      warehouseId,
      returnDate,
      lines,
    });
    setSubmitting(false);
    if (result.success) {
      toast.success("Return processed");
      setLines([]);
      router.refresh();
    } else toast.error(result.error);
  }

  return (
    <div className="rounded-lg border p-4 space-y-4 max-w-2xl">
      <h3 className="font-medium">Supplier Return</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Supplier</Label>
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
        </div>
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
          <Label>Return Date</Label>
          <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
        </div>
      </div>
      <PurchaseVariantSearch onSelect={addVariant} />
      {lines.map((l, i) => (
        <div key={l.variantId} className="flex gap-2 text-sm">
          <span className="flex-1">{l.label}</span>
          <Input
            type="number"
            className="w-24"
            value={l.quantity}
            onChange={(e) =>
              setLines(lines.map((x, idx) => (idx === i ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x)))
            }
          />
          <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button onClick={handleReturn} disabled={submitting || lines.length === 0}>
        {submitting ? "Processing..." : "Process Return"}
      </Button>
    </div>
  );
}

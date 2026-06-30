"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VariantSearchInput, type VariantOption } from "./variant-search-input";
import { ADJUSTMENT_REASONS } from "@/features/inventory/constants/adjustment-reasons";
import { adjustStockAction } from "@/features/inventory/actions/inventory.actions";

interface LineItem {
  variantId: string;
  label: string;
  quantity: number;
  direction: "IN" | "OUT";
  unitCost?: number;
}

interface AdjustmentFormProps {
  warehouses: { id: string; name: string; code: string }[];
  defaultWarehouseId?: string;
}

export function AdjustmentForm({ warehouses, defaultWarehouseId }: AdjustmentFormProps) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? warehouses[0]?.id ?? "");
  const [movementDate, setMovementDate] = useState(new Date().toISOString().slice(0, 10));
  const [reasonCode, setReasonCode] = useState<string>(ADJUSTMENT_REASONS[0].code);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function handleAddVariant(variant: VariantOption) {
    if (lines.some((l) => l.variantId === variant.id)) {
      toast.error("Product already added");
      return;
    }
    setLines([
      ...lines,
      {
        variantId: variant.id,
        label: `${variant.product.name} (${variant.sku})`,
        quantity: 1,
        direction: "IN",
        unitCost: Number(variant.costPrice),
      },
    ]);
  }

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    setLines(lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!warehouseId || lines.length === 0) {
      toast.error("Warehouse and at least one line required");
      return;
    }

    setSubmitting(true);
    const result = await adjustStockAction({
      warehouseId,
      movementDate,
      reasonCode,
      notes: notes || undefined,
      lines,
    });
    setSubmitting(false);

    if (result.success) {
      toast.success("Adjustment saved");
      router.push("/inventory");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
                  {w.code} — {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Reason</Label>
          <Select value={reasonCode} onValueChange={setReasonCode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADJUSTMENT_REASONS.map((r) => (
                <SelectItem key={r.code} value={r.code}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Add Products</Label>
        <VariantSearchInput onSelect={handleAddVariant} />
      </div>

      {lines.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-28">Direction</TableHead>
                <TableHead className="w-28">Qty</TableHead>
                <TableHead className="w-32">Unit Cost</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, i) => (
                <TableRow key={line.variantId}>
                  <TableCell>{line.label}</TableCell>
                  <TableCell>
                    <Select
                      value={line.direction}
                      onValueChange={(v) => updateLine(i, "direction", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN">Increase (+)</SelectItem>
                        <SelectItem value="OUT">Decrease (−)</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0.0001"
                      step="any"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    {line.direction === "IN" ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitCost ?? ""}
                        onChange={(e) =>
                          updateLine(i, "unitCost", parseFloat(e.target.value) || 0)
                        }
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">Auto</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || lines.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          {submitting ? "Saving..." : "Save Adjustment"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/inventory")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

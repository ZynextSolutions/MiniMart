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
import { stockInAction, stockOutAction } from "@/features/inventory/actions/inventory.actions";

interface LineItem {
  variantId: string;
  label: string;
  quantity: number;
  unitCost?: number;
  batchNumber?: string;
  expiryDate?: string;
  trackBatch: boolean;
  trackExpiry: boolean;
  unit: string;
}

interface StockMovementFormProps {
  type: "in" | "out";
  warehouses: { id: string; name: string; code: string }[];
  defaultWarehouseId?: string;
}

export function StockMovementForm({
  type,
  warehouses,
  defaultWarehouseId,
}: StockMovementFormProps) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? warehouses[0]?.id ?? "");
  const [movementDate, setMovementDate] = useState(new Date().toISOString().slice(0, 10));
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
        unitCost: type === "in" ? Number(variant.costPrice) : undefined,
        trackBatch: variant.product.trackBatch,
        trackExpiry: variant.product.trackExpiry,
        unit: variant.product.unit.abbreviation,
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
    if (!warehouseId) {
      toast.error("Select a warehouse");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    setSubmitting(true);
    const payload = {
      warehouseId,
      movementDate,
      notes: notes || undefined,
      lines: lines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        unitCost: l.unitCost,
        batchNumber: l.batchNumber,
        expiryDate: l.expiryDate,
      })),
    };

    const result =
      type === "in" ? await stockInAction(payload) : await stockOutAction(payload);

    setSubmitting(false);

    if (result.success) {
      toast.success(type === "in" ? "Stock received" : "Stock issued");
      router.push("/inventory");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Warehouse</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger>
              <SelectValue placeholder="Select warehouse" />
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
          <Input
            type="date"
            value={movementDate}
            onChange={(e) => setMovementDate(e.target.value)}
            required
          />
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
                <TableHead className="w-28">Qty</TableHead>
                {type === "in" && <TableHead className="w-32">Unit Cost</TableHead>}
                {type === "in" && <TableHead className="w-32">Batch #</TableHead>}
                {type === "in" && <TableHead className="w-36">Expiry</TableHead>}
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, i) => (
                <TableRow key={line.variantId}>
                  <TableCell className="font-medium">{line.label}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0.0001"
                      step="any"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  {type === "in" && (
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitCost ?? ""}
                        onChange={(e) =>
                          updateLine(i, "unitCost", parseFloat(e.target.value) || 0)
                        }
                      />
                    </TableCell>
                  )}
                  {type === "in" && (
                    <TableCell>
                      {line.trackBatch ? (
                        <Input
                          placeholder="Batch #"
                          value={line.batchNumber ?? ""}
                          onChange={(e) => updateLine(i, "batchNumber", e.target.value)}
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  )}
                  {type === "in" && (
                    <TableCell>
                      {line.trackExpiry ? (
                        <Input
                          type="date"
                          value={line.expiryDate ?? ""}
                          onChange={(e) => updateLine(i, "expiryDate", e.target.value)}
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  )}
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
          {submitting ? "Saving..." : type === "in" ? "Receive Stock" : "Issue Stock"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/inventory")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

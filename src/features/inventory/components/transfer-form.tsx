"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft, Trash2 } from "lucide-react";
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
import { transferStockAction } from "@/features/inventory/actions/inventory.actions";

interface LineItem {
  variantId: string;
  label: string;
  quantity: number;
}

interface TransferFormProps {
  warehouses: { id: string; name: string; code: string }[];
}

export function TransferForm({ warehouses }: TransferFormProps) {
  const router = useRouter();
  const [sourceWarehouseId, setSourceWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [destWarehouseId, setDestWarehouseId] = useState(warehouses[1]?.id ?? warehouses[0]?.id ?? "");
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
      },
    ]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sourceWarehouseId === destWarehouseId) {
      toast.error("Source and destination must differ");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    setSubmitting(true);
    const result = await transferStockAction({
      sourceWarehouseId,
      destWarehouseId,
      movementDate,
      notes: notes || undefined,
      lines,
    });
    setSubmitting(false);

    if (result.success) {
      toast.success("Transfer completed");
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
          <Label>From Warehouse</Label>
          <Select value={sourceWarehouseId} onValueChange={setSourceWarehouseId}>
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
          <Label>To Warehouse</Label>
          <Select value={destWarehouseId} onValueChange={setDestWarehouseId}>
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
                <TableHead className="w-32">Quantity</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, i) => (
                <TableRow key={line.variantId}>
                  <TableCell>{line.label}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0.0001"
                      step="any"
                      value={line.quantity}
                      onChange={(e) => {
                        const qty = parseFloat(e.target.value) || 0;
                        setLines(lines.map((l, idx) => (idx === i ? { ...l, quantity: qty } : l)));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                    >
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
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          {submitting ? "Transferring..." : "Transfer Stock"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/inventory")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

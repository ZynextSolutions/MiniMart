"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/utils/format";
import {
  updateStockCountLinesAction,
  completeStockCountAction,
} from "@/features/inventory/actions/inventory.actions";
import type { Decimal } from "@prisma/client/runtime/library";

interface StockCountLine {
  id: string;
  systemQty: Decimal;
  countedQty: Decimal;
  variance: Decimal;
  variant: {
    sku: string;
    name: string;
    product: { name: string; unit: { abbreviation: string } };
  };
}

interface StockCountDetailClientProps {
  stockCount: {
    id: string;
    countNumber: string;
    countDate: Date;
    status: string;
    warehouse: { name: string };
    lines: StockCountLine[];
  };
}

export function StockCountDetailClient({ stockCount }: StockCountDetailClientProps) {
  const router = useRouter();
  const isDraft = stockCount.status === "DRAFT";
  const [lines, setLines] = useState(
    stockCount.lines.map((l) => ({
      id: l.id,
      countedQty: Number(l.countedQty),
      systemQty: Number(l.systemQty),
      label: `${l.variant.product.name} (${l.variant.sku})`,
      unit: l.variant.product.unit.abbreviation,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateStockCountLinesAction(
      stockCount.id,
      lines.map((l) => ({ id: l.id, countedQty: l.countedQty })),
    );
    setSaving(false);
    if (result.success) {
      toast.success("Counts saved");
      router.refresh();
      return true;
    } else {
      toast.error(result.error);
      return false;
    }
  }

  async function handleComplete() {
    setCompleting(true);
    const saved = await handleSave();
    if (!saved) {
      setCompleting(false);
      return;
    }
    const result = await completeStockCountAction(stockCount.id);
    setCompleting(false);
    if (result.success) {
      toast.success("Stock count completed — variances adjusted");
      router.push("/inventory/stock-count");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">{stockCount.warehouse.name}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(stockCount.countDate).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={isDraft ? "outline" : "secondary"}>{stockCount.status}</Badge>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">System Qty</TableHead>
              <TableHead className="text-right w-36">Counted Qty</TableHead>
              <TableHead className="text-right">Variance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, i) => {
              const variance = line.countedQty - line.systemQty;
              return (
                <TableRow key={line.id}>
                  <TableCell>{line.label}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(line.systemQty)} {line.unit}
                  </TableCell>
                  <TableCell>
                    {isDraft ? (
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        className="text-right"
                        value={line.countedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setLines(lines.map((l, idx) => (idx === i ? { ...l, countedQty: val } : l)));
                        }}
                      />
                    ) : (
                      <span className="block text-right">
                        {formatNumber(line.countedQty)} {line.unit}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {variance > 0 ? "+" : ""}
                    {formatNumber(variance)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {isDraft && (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSave} disabled={saving || completing}>
            {saving ? "Saving..." : "Save Counts"}
          </Button>
          <Button onClick={handleComplete} disabled={completing || saving}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {completing ? "Completing..." : "Complete & Adjust"}
          </Button>
        </div>
      )}
    </div>
  );
}

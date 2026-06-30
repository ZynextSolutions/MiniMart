"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { createStockCountAction } from "@/features/inventory/actions/inventory.actions";

interface StockCountRow {
  id: string;
  countNumber: string;
  countDate: Date;
  status: string;
  warehouse: { name: string; code: string };
  _count: { lines: number };
}

interface StockCountListClientProps {
  stockCounts: StockCountRow[];
  warehouses: { id: string; name: string; code: string }[];
}

export function StockCountListClient({ stockCounts, warehouses }: StockCountListClientProps) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [countDate, setCountDate] = useState(new Date().toISOString().slice(0, 10));
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!warehouseId) {
      toast.error("Select a warehouse");
      return;
    }
    setCreating(true);
    const result = await createStockCountAction({ warehouseId, countDate });
    setCreating(false);
    if (result.success && result.stockCount) {
      toast.success("Stock count created");
      router.push(`/inventory/stock-count/${result.stockCount.id}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to create stock count");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-medium">New Stock Count</h3>
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
            <Label>Count Date</Label>
            <Input type="date" value={countDate} onChange={(e) => setCountDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleCreate} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              {creating ? "Creating..." : "Start Count"}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Count #</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockCounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No stock counts yet.
                </TableCell>
              </TableRow>
            ) : (
              stockCounts.map((sc) => (
                <TableRow key={sc.id}>
                  <TableCell className="font-medium">{sc.countNumber}</TableCell>
                  <TableCell>{sc.warehouse.name}</TableCell>
                  <TableCell>{new Date(sc.countDate).toLocaleDateString()}</TableCell>
                  <TableCell>{sc._count.lines}</TableCell>
                  <TableCell>
                    <Badge variant={sc.status === "COMPLETED" ? "secondary" : "outline"}>
                      {sc.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/inventory/stock-count/${sc.id}`}>
                        <ClipboardCheck className="mr-1 h-4 w-4" />
                        Open
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

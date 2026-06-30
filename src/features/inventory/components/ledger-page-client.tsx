"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatMoney, formatNumber } from "@/lib/utils/format";
import type { MovementType } from "@prisma/client";

interface LedgerEntry {
  id: string;
  movementType: MovementType;
  quantity: number;
  balanceAfter: number;
  unitCost: number;
  referenceType: string;
  createdAt: string;
  variant: { sku: string; name: string; product: { name: string } };
}

interface LedgerPageClientProps {
  entries: LedgerEntry[];
  warehouses: { id: string; name: string }[];
  totalPages: number;
  page: number;
  initialWarehouseId?: string;
  initialFrom?: string;
  initialTo?: string;
}

const movementLabels: Record<string, string> = {
  STOCK_IN: "Stock In",
  STOCK_OUT: "Stock Out",
  ADJUSTMENT_IN: "Adjustment +",
  ADJUSTMENT_OUT: "Adjustment −",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  SALE: "Sale",
  PURCHASE: "Purchase",
  RETURN_IN: "Return In",
  RETURN_OUT: "Return Out",
  DAMAGE: "Damage",
  EXPIRED: "Expired",
};

export function LedgerPageClient({
  entries,
  warehouses,
  totalPages,
  page,
  initialWarehouseId,
  initialFrom,
  initialTo,
}: LedgerPageClientProps) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId ?? "all");
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");

  function applyFilters() {
    const params = new URLSearchParams();
    if (warehouseId && warehouseId !== "all") params.set("warehouse", warehouseId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/inventory/ledger?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All warehouses</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        <Button variant="secondary" onClick={applyFilters}>
          <Search className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No ledger entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">
                    {new Date(e.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{e.variant.product.name}</div>
                    <div className="text-xs text-muted-foreground">{e.variant.sku}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{movementLabels[e.movementType] ?? e.movementType}</Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      e.quantity > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {e.quantity > 0 ? "+" : ""}
                    {formatNumber(e.quantity)}
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(e.unitCost)}</TableCell>
                  <TableCell className="text-right">{formatNumber(e.balanceAfter)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.set("page", String(page - 1));
              router.push(`/inventory/ledger?${params.toString()}`);
            }}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.set("page", String(page + 1));
              router.push(`/inventory/ledger?${params.toString()}`);
            }}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

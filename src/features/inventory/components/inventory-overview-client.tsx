"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Search, AlertTriangle, Package, DollarSign, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { initializeStockLevelsAction } from "@/features/inventory/actions/inventory.actions";

interface StockLevel {
  id: string;
  quantity: number;
  avgCost: number;
  costingMethod: string;
  warehouse: { id: string; name: string; code: string };
  variant: {
    sku: string;
    name: string;
    product: {
      name: string;
      reorderLevel: number;
      unit: { abbreviation: string };
    };
  };
}

interface ValuationRow {
  variantId: string;
  productName: string;
  sku: string;
  warehouseName: string;
  quantity: number;
  avgCost: number;
  totalValue: number;
}

interface InventoryOverviewProps {
  levels: StockLevel[];
  valuation: ValuationRow[];
  summary: {
    totalValue: number;
    lowStockCount: number;
    totalSkus: number;
    inStockSkus: number;
  };
  warehouses: { id: string; name: string; code: string }[];
  totalPages: number;
  page: number;
  initialSearch: string;
  initialWarehouseId?: string;
  canInitialize: boolean;
}

export function InventoryOverviewClient({
  levels,
  valuation,
  summary,
  warehouses,
  totalPages,
  page,
  initialSearch,
  initialWarehouseId,
  canInitialize,
}: InventoryOverviewProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId ?? "all");
  const [initializing, setInitializing] = useState(false);

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (warehouseId && warehouseId !== "all") params.set("warehouse", warehouseId);
    router.push(`/inventory?${params.toString()}`);
  }

  async function handleInitialize() {
    const wh = warehouseId !== "all" ? warehouseId : warehouses[0]?.id;
    if (!wh) return;
    setInitializing(true);
    const result = await initializeStockLevelsAction(wh);
    setInitializing(false);
    if (result.success && "created" in result) {
      toast.success(`Initialized ${result.created} stock level records`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const totalValuation = valuation.reduce((s, r) => s + Number(r.totalValue), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(summary.totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">SKUs Tracked</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalSkus}</div>
            <p className="text-xs text-muted-foreground">{summary.inStockSkus} in stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{summary.lowStockCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Valuation Rows</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totalValuation)}</div>
            <p className="text-xs text-muted-foreground">From on-hand stock</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
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
        <Button variant="secondary" onClick={applyFilters}>
          Filter
        </Button>
        {canInitialize && (
          <Button variant="outline" onClick={handleInitialize} disabled={initializing}>
            {initializing ? "Initializing..." : "Initialize Stock Levels"}
          </Button>
        )}
        <Button asChild>
          <Link href="/inventory/stock-in">Stock In</Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Avg Cost</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No stock levels found. Receive stock or initialize levels.
                </TableCell>
              </TableRow>
            ) : (
              levels.map((l) => {
                const isLow =
                  l.quantity <= l.variant.product.reorderLevel &&
                  l.variant.product.reorderLevel > 0;
                const value = l.quantity * l.avgCost;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.variant.product.name}</TableCell>
                    <TableCell>{l.variant.sku}</TableCell>
                    <TableCell>{l.warehouse.name}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(l.quantity)} {l.variant.product.unit.abbreviation}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(l.avgCost)}</TableCell>
                    <TableCell className="text-right">{formatMoney(value)}</TableCell>
                    <TableCell>
                      {isLow ? (
                        <Badge variant="destructive">Low</Badge>
                      ) : l.quantity > 0 ? (
                        <Badge variant="secondary">OK</Badge>
                      ) : (
                        <Badge variant="outline">Empty</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
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
              router.push(`/inventory?${params.toString()}`);
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
              router.push(`/inventory?${params.toString()}`);
            }}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

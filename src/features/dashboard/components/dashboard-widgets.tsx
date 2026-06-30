"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils/format";
import { formatDistanceToNow } from "date-fns";
import type {
  ExpiryWarning,
  LowStockAlert,
  RecentTransaction,
} from "./dashboard-types";

export function RecentTransactionsWidget({
  transactions,
  currency,
}: {
  transactions: RecentTransaction[];
  currency: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest completed sales</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/reports/sales">
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No transactions yet
          </p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">
                      {tx.invoiceNumber}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {tx.paymentMethods.join(", ") || "—"}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {tx.customerName} · {tx.cashierName}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(tx.saleDate), { addSuffix: true })}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">{formatMoney(tx.grandTotal, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LowStockWidget({ alerts }: { alerts: LowStockAlert[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-600" />
            Low Stock Alerts
          </CardTitle>
          <CardDescription>Items at or below reorder level</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/inventory">
            View inventory
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            All stock levels are healthy
          </p>
        ) : (
          <div className="space-y-2">
            {alerts.map((item) => (
              <div
                key={`${item.variantId}-${item.warehouseName}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/60 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.sku} · {item.warehouseName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {item.quantity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    reorder {item.reorderLevel}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ExpiryWarningsWidget({ warnings }: { warnings: ExpiryWarning[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Expiry Warnings
          </CardTitle>
          <CardDescription>Batches expiring within 30 days</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/inventory">
            View inventory
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {warnings.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No batches expiring soon
          </p>
        ) : (
          <div className="space-y-2">
            {warnings.map((item) => (
              <div
                key={item.batchId}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    Batch {item.batchNumber} · Qty {item.remainingQty}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge
                    variant={item.daysUntilExpiry <= 7 ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {item.daysUntilExpiry}d left
                  </Badge>
                  <p className="mt-1 text-xs text-muted-foreground">{item.expiryDate}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

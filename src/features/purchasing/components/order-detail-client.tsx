"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/utils/format";

interface OrderDetailClientProps {
  order: {
    id: string;
    orderNumber: string;
    orderDate: Date;
    expectedDate: Date | null;
    status: string;
    notes: string | null;
    totalAmount: { toString(): string };
    supplier: { name: string; code: string; email: string | null };
    lines: {
      id: string;
      quantity: { toString(): string };
      receivedQty: { toString(): string };
      unitCost: { toString(): string };
      variant?: { sku: string; product: { name: string } };
    }[];
    goodsReceipts: {
      id: string;
      receiptNumber: string;
      receiptDate: Date;
      status: string;
      _count: { lines: number };
    }[];
  };
}

export function OrderDetailClient({ order }: OrderDetailClientProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Badge variant="outline">{order.status}</Badge>
        <span className="text-muted-foreground">
          {order.supplier.code} — {order.supplier.name}
        </span>
        {order.status === "APPROVED" && (
          <Button size="sm" asChild>
            <Link href={`/purchasing/receiving?po=${order.id}`}>Receive Goods</Link>
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.variant?.product.name ?? "—"}</TableCell>
                <TableCell>{l.variant?.sku ?? "—"}</TableCell>
                <TableCell className="text-right">{Number(l.quantity)}</TableCell>
                <TableCell className="text-right">{Number(l.receivedQty)}</TableCell>
                <TableCell className="text-right">{formatMoney(Number(l.unitCost))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="font-medium mb-2">Goods Receipts</h3>
        {order.goodsReceipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No receipts yet</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.goodsReceipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.receiptNumber}</TableCell>
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
        )}
      </div>

      <p className="text-lg font-semibold">
        Total: {formatMoney(Number(order.totalAmount))}
      </p>
    </div>
  );
}

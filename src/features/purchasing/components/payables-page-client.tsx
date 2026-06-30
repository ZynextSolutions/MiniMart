"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { recordSupplierPaymentAction } from "@/features/purchasing/actions/purchasing.actions";

interface PayableRow {
  id: string;
  invoiceNumber: string;
  supplier: { id: string; name: string; code: string };
  dueDate: Date;
  totalAmount: { toString(): string };
  paidAmount: { toString(): string };
  outstanding: { toString(): string };
  status: string;
}

export function PayablesPageClient({ payables }: { payables: PayableRow[] }) {
  const router = useRouter();
  const [paying, setPaying] = useState<string | null>(null);

  const totalOutstanding = payables.reduce((s, p) => s + Number(p.outstanding), 0);

  async function quickPay(row: PayableRow) {
    setPaying(row.id);
    const result = await recordSupplierPaymentAction({
      supplierId: row.supplier.id,
      invoiceId: row.id,
      amount: Number(row.outstanding),
      paymentDate: new Date().toISOString().slice(0, 10),
      method: "BANK",
    });
    setPaying(null);
    if (result.success) {
      toast.success("Payment recorded");
      router.refresh();
    } else toast.error(result.error);
  }

  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold">
        Total Outstanding: {formatMoney(totalOutstanding)}
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No outstanding payables
                </TableCell>
              </TableRow>
            ) : (
              payables.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.invoiceNumber}</TableCell>
                  <TableCell>{p.supplier.name}</TableCell>
                  <TableCell>{new Date(p.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-semibold text-amber-600">
                    {formatMoney(Number(p.outstanding))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => quickPay(p)}
                      disabled={paying === p.id}
                    >
                      {paying === p.id ? "..." : "Pay Full"}
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

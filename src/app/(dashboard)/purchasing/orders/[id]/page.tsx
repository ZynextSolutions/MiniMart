import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";
import { OrderDetailClient } from "@/features/purchasing/components/order-detail-client";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.PURCHASING.ORDER_CREATE);

  const { id } = await params;
  const order = await PurchasingQueryService.getPurchaseOrderDetail(id, session.user.organizationId);

  if (!order) notFound();

  const serializedOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    orderDate: order.orderDate.toISOString(),
    expectedDate: order.expectedDate?.toISOString() ?? null,
    status: order.status,
    notes: order.notes,
    totalAmount: Number(order.totalAmount),
    supplier: {
      name: order.supplier.name,
      code: order.supplier.code,
      email: order.supplier.email,
    },
    lines: order.lines.map((l) => ({
      id: l.id,
      quantity: Number(l.quantity),
      receivedQty: Number(l.receivedQty),
      unitCost: Number(l.unitCost),
      variant: l.variant
        ? { sku: l.variant.sku, product: { name: l.variant.product.name } }
        : undefined,
    })),
    goodsReceipts: order.goodsReceipts.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      receiptDate: r.receiptDate.toISOString(),
      status: r.status,
      _count: r._count,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/purchasing/orders">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
          <p className="text-muted-foreground">
            Ordered {new Date(order.orderDate).toLocaleDateString()}
          </p>
        </div>
      </div>
      <OrderDetailClient order={serializedOrder} />
    </div>
  );
}

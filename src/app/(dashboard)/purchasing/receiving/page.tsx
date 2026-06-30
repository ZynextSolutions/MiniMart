import { Suspense } from "react";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";
import { ReceivingPageClient } from "@/features/purchasing/components/receiving-page-client";

export default async function GoodsReceivingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.PURCHASING.RECEIVE);

  const [receipts, warehouses, approvedOrders] = await Promise.all([
    PurchasingQueryService.listGoodsReceipts(session.user.organizationId),
    WarehouseService.list(session.user.organizationId, session.user.branchId ?? undefined),
    PurchasingQueryService.listPurchaseOrders(session.user.organizationId, "APPROVED"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Goods Receiving</h1>
        <p className="text-muted-foreground">Receive stock against a PO or ad-hoc</p>
      </div>
      <Suspense>
        <ReceivingPageClient
          receipts={receipts}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
          approvedOrders={approvedOrders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            supplier: o.supplier,
          }))}
        />
      </Suspense>
    </div>
  );
}

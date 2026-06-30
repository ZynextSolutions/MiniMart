import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";
import { OrdersPageClient } from "@/features/purchasing/components/orders-page-client";

export default async function PurchaseOrdersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.PURCHASING.ORDER_CREATE);

  const [orders, { suppliers }] = await Promise.all([
    PurchasingQueryService.listPurchaseOrders(session.user.organizationId),
    SupplierService.list(session.user.organizationId, { pageSize: 100 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
        <p className="text-muted-foreground">Manage supplier purchase orders</p>
      </div>
      <OrdersPageClient
        orders={orders}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      />
    </div>
  );
}

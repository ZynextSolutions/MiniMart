import { authorizeSession, requireSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { getUserBranches } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";
import { OrdersPageClient } from "@/features/purchasing/components/orders-page-client";
import { DashboardBranchFilter } from "@/features/dashboard/components/dashboard-branch-filter";

interface Props {
  searchParams: Promise<{ branchId?: string }>;
}

export default async function PurchaseOrdersPage({ searchParams }: Props) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.PURCHASING.ORDER_CREATE);
  const params = await searchParams;

  const branchFilter = resolveSessionBranchFilter(session.user, params.branchId);
  const [orders, { suppliers }, branches] = await Promise.all([
    PurchasingQueryService.listPurchaseOrders({
      organizationId: session.user.organizationId,
      branchId: branchFilter,
    }),
    SupplierService.list(session.user.organizationId, { pageSize: 100 }),
    getUserBranches(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage supplier purchase orders</p>
        </div>
        <DashboardBranchFilter
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          selectedBranchId={params.branchId ?? session.user.branchId ?? undefined}
          allEncoding="param"
        />
      </div>
      <OrdersPageClient
        orders={orders}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      />
    </div>
  );
}

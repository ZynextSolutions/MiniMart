import { Suspense } from "react";
import { authorizeSession, requireSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { getUserBranches } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";
import { ReceivingPageClient } from "@/features/purchasing/components/receiving-page-client";
import { DashboardBranchFilter } from "@/features/dashboard/components/dashboard-branch-filter";

interface Props {
  searchParams: Promise<{ branchId?: string }>;
}

export default async function GoodsReceivingPage({ searchParams }: Props) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.PURCHASING.RECEIVE);
  const params = await searchParams;
  const branchFilter = resolveSessionBranchFilter(session.user, params.branchId);

  const [receipts, warehouses, approvedOrders, branches] = await Promise.all([
    PurchasingQueryService.listGoodsReceipts({
      organizationId: session.user.organizationId,
      branchId: branchFilter,
    }),
    WarehouseService.list(
      session.user.organizationId,
      typeof branchFilter === "string" ? branchFilter : session.user.branchId ?? undefined,
    ),
    PurchasingQueryService.listPurchaseOrders({
      organizationId: session.user.organizationId,
      status: "APPROVED",
      branchId: branchFilter,
    }),
    getUserBranches(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goods Receiving</h1>
          <p className="text-muted-foreground">Receive stock against a PO or ad-hoc</p>
        </div>
        <DashboardBranchFilter
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          selectedBranchId={params.branchId ?? session.user.branchId ?? undefined}
          allEncoding="param"
        />
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

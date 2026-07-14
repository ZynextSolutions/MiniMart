import { authorizeSession, requireSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { getUserBranches } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { InventoryQueryService } from "@/features/inventory/services/inventory-query.service";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { InventoryOverviewClient } from "@/features/inventory/components/inventory-overview-client";
import { DashboardBranchFilter } from "@/features/dashboard/components/dashboard-branch-filter";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    warehouse?: string;
    page?: string;
    branchId?: string;
  }>;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.INVENTORY.VIEW);

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const warehouseId = params.warehouse;
  const branchFilter = resolveSessionBranchFilter(session.user, params.branchId);

  const [stockResult, valuation, summary, warehouses, branches] = await Promise.all([
    InventoryQueryService.listStockLevels({
      organizationId: session.user.organizationId,
      branchId: branchFilter,
      warehouseId,
      search: params.search,
      page,
    }),
    InventoryQueryService.getValuation(
      session.user.organizationId,
      warehouseId,
      branchFilter,
    ),
    InventoryQueryService.getSummary(session.user.organizationId, branchFilter),
    WarehouseService.list(
      session.user.organizationId,
      typeof branchFilter === "string" ? branchFilter : session.user.branchId ?? undefined,
    ),
    getUserBranches(session.user.id),
  ]);

  const clientLevels = stockResult.levels.map((l) => ({
    ...l,
    quantity: Number(l.quantity),
    avgCost: Number(l.avgCost),
    reservedQty: Number(l.reservedQty),
    variant: {
      ...l.variant,
      product: {
        ...l.variant.product,
        reorderLevel: Number(l.variant.product.reorderLevel),
        minStock: Number(l.variant.product.minStock),
      },
    },
  }));

  const clientValuation = valuation.map((v) => ({
    ...v,
    quantity: Number(v.quantity),
    avgCost: Number(v.avgCost),
    totalValue: Number(v.totalValue),
  }));

  const clientSummary = {
    ...summary,
    totalValue: Number(summary.totalValue),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Stock levels, valuation, and movements</p>
        </div>
        <DashboardBranchFilter
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          selectedBranchId={params.branchId ?? session.user.branchId ?? undefined}
          allEncoding="param"
        />
      </div>
      <InventoryOverviewClient
        levels={clientLevels}
        valuation={clientValuation}
        summary={clientSummary}
        warehouses={warehouses}
        totalPages={stockResult.totalPages}
        page={stockResult.page}
        initialSearch={params.search ?? ""}
        initialWarehouseId={warehouseId}
        canInitialize={warehouses.length > 0}
      />
    </div>
  );
}

import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { InventoryQueryService } from "@/features/inventory/services/inventory-query.service";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { InventoryOverviewClient } from "@/features/inventory/components/inventory-overview-client";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; warehouse?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.INVENTORY.VIEW);

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const warehouseId = params.warehouse;

  const [stockResult, valuation, summary, warehouses] = await Promise.all([
    InventoryQueryService.listStockLevels({
      organizationId: session.user.organizationId,
      warehouseId,
      search: params.search,
      page,
    }),
    InventoryQueryService.getValuation(session.user.organizationId, warehouseId),
    InventoryQueryService.getSummary(session.user.organizationId),
    WarehouseService.list(session.user.organizationId, session.user.branchId ?? undefined),
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">Stock levels, valuation, and movements</p>
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

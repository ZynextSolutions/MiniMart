import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { InventoryQueryService } from "@/features/inventory/services/inventory-query.service";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { StockCountListClient } from "@/features/inventory/components/stock-count-list-client";

export default async function StockCountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.INVENTORY.STOCK_COUNT);

  const [stockCounts, warehouses] = await Promise.all([
    InventoryQueryService.listStockCounts(session.user.organizationId),
    WarehouseService.list(session.user.organizationId, session.user.branchId ?? undefined),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock Count</h1>
        <p className="text-muted-foreground">Physical count with variance adjustment</p>
      </div>
      <StockCountListClient stockCounts={stockCounts} warehouses={warehouses} />
    </div>
  );
}

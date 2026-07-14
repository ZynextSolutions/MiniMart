import { authorizeSession, requireSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { InventoryQueryService } from "@/features/inventory/services/inventory-query.service";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { LedgerPageClient } from "@/features/inventory/components/ledger-page-client";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{
    warehouse?: string;
    from?: string;
    to?: string;
    page?: string;
    branchId?: string;
  }>;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.INVENTORY.LEDGER_VIEW);

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const branchFilter = resolveSessionBranchFilter(session.user, params.branchId);

  const [ledgerResult, warehouses] = await Promise.all([
    InventoryQueryService.getLedger({
      organizationId: session.user.organizationId,
      branchId: branchFilter,
      warehouseId: params.warehouse,
      from: params.from ? new Date(params.from) : undefined,
      to: params.to ? new Date(params.to + "T23:59:59") : undefined,
      page,
    }),
    WarehouseService.list(
      session.user.organizationId,
      typeof branchFilter === "string" ? branchFilter : session.user.branchId ?? undefined,
    ),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory Ledger</h1>
        <p className="text-muted-foreground">Movement history with running balance</p>
      </div>
      <LedgerPageClient
        entries={ledgerResult.entries}
        warehouses={warehouses}
        totalPages={ledgerResult.totalPages}
        page={ledgerResult.page}
        initialWarehouseId={params.warehouse}
        initialFrom={params.from}
        initialTo={params.to}
      />
    </div>
  );
}

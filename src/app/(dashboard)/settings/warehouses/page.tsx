import { requireSession } from "@/lib/auth/session";
import {
  authorize,
  getUserBranches,
} from "@/lib/permissions/authorization";
import { resolveAuthorizedBranchFilter } from "@/lib/auth/branch-access";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { WarehousesPageClient } from "@/features/warehouses/components/warehouses-page-client";

export default async function WarehousesPage() {
  const session = await requireSession();
  // Any authorized branch assignment with this permission may open the page;
  // warehouse rows are still filtered to session.user.branchIds below.
  await authorize(session.user.id, PERMISSIONS.SETTINGS.WAREHOUSE_MANAGE);

  const branches = await getUserBranches(session.user.id);
  const branchFilter = resolveAuthorizedBranchFilter(
    session.user.branchIds,
    null,
  );

  const warehouses = await WarehouseService.list(
    session.user.organizationId,
    branchFilter,
  );

  return (
    <WarehousesPageClient
      initialWarehouses={warehouses}
      branches={branches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
      }))}
    />
  );
}

import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { AdjustmentForm } from "@/features/inventory/components/adjustment-form";

export default async function AdjustmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.INVENTORY.ADJUST);

  const warehouses = await WarehouseService.list(
    session.user.organizationId,
    session.user.branchId ?? undefined,
  );

  const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? warehouses[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock Adjustments</h1>
        <p className="text-muted-foreground">Correct stock with reason codes</p>
      </div>
      <AdjustmentForm warehouses={warehouses} defaultWarehouseId={defaultWarehouse?.id} />
    </div>
  );
}

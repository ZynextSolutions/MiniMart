import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { TransferForm } from "@/features/inventory/components/transfer-form";

export default async function TransfersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.INVENTORY.TRANSFER);

  const warehouses = await WarehouseService.list(session.user.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Warehouse Transfer</h1>
        <p className="text-muted-foreground">Move stock between warehouses (out + in)</p>
      </div>
      <TransferForm warehouses={warehouses} />
    </div>
  );
}

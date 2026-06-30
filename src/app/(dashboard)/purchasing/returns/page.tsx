import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { ReturnsPageClient } from "@/features/purchasing/components/returns-page-client";

export default async function SupplierReturnsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.PURCHASING.RETURN);

  const [{ suppliers }, warehouses] = await Promise.all([
    SupplierService.list(session.user.organizationId, { pageSize: 100 }),
    WarehouseService.list(session.user.organizationId, session.user.branchId ?? undefined),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Supplier Returns</h1>
        <p className="text-muted-foreground">Return goods to suppliers and credit AP</p>
      </div>
      <ReturnsPageClient
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
      />
    </div>
  );
}

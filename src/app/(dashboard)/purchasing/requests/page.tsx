import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";
import { RequestsPageClient } from "@/features/purchasing/components/requests-page-client";

export default async function PurchaseRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.PURCHASING.REQUEST_CREATE);

  const [requests, { suppliers }] = await Promise.all([
    PurchasingQueryService.listPurchaseRequests(session.user.organizationId),
    SupplierService.list(session.user.organizationId, { pageSize: 100 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Purchase Requests</h1>
        <p className="text-muted-foreground">Create and approve purchase requests before ordering</p>
      </div>
      <RequestsPageClient
        requests={requests}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      />
    </div>
  );
}

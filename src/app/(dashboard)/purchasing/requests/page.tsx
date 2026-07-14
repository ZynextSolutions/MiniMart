import { authorizeSession, requireSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";
import { RequestsPageClient } from "@/features/purchasing/components/requests-page-client";

export default async function PurchaseRequestsPage() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.PURCHASING.REQUEST_CREATE);

  const [requests, { suppliers }] = await Promise.all([
    PurchasingQueryService.listPurchaseRequests({
      organizationId: session.user.organizationId,
    }),
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

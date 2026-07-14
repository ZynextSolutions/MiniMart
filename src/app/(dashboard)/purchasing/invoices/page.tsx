import { authorizeSession, requireSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";
import { InvoicesPageClient } from "@/features/purchasing/components/invoices-page-client";

export default async function SupplierInvoicesPage() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.PURCHASING.INVOICE_MANAGE);

  const [invoices, { suppliers }] = await Promise.all([
    PurchasingQueryService.listSupplierInvoices({
      organizationId: session.user.organizationId,
    }),
    SupplierService.list(session.user.organizationId, { pageSize: 100 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Supplier Invoices</h1>
        <p className="text-muted-foreground">Record AP invoices and payments</p>
      </div>
      <InvoicesPageClient
        invoices={invoices}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      />
    </div>
  );
}

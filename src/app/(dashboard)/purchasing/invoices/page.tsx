import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";
import { InvoicesPageClient } from "@/features/purchasing/components/invoices-page-client";

export default async function SupplierInvoicesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.PURCHASING.INVOICE_MANAGE);

  const [invoices, { suppliers }] = await Promise.all([
    PurchasingQueryService.listSupplierInvoices(session.user.organizationId),
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

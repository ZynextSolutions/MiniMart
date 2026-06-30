import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";
import { PayablesPageClient } from "@/features/purchasing/components/payables-page-client";

export default async function PayablesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.PURCHASING.INVOICE_MANAGE);

  const payables = await PurchasingQueryService.getOutstandingPayables(session.user.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Outstanding Payables</h1>
        <p className="text-muted-foreground">Unpaid supplier invoices</p>
      </div>
      <PayablesPageClient payables={payables} />
    </div>
  );
}

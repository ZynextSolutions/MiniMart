import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { FiscalYearPageClient } from "@/features/accounting/components/fiscal-year-page-client";

export default async function FiscalYearPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.ACCOUNTING.PERIOD_CLOSE);

  const fiscalYears = await AccountingQueryService.listFiscalYears(session.user.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fiscal Year & Periods</h1>
        <p className="text-muted-foreground">Manage fiscal years and close accounting periods</p>
      </div>
      <FiscalYearPageClient fiscalYears={fiscalYears} />
    </div>
  );
}

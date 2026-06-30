import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { AgingReportClient } from "@/features/accounting/components/aging-report-client";

interface Props {
  searchParams: Promise<{ asOf?: string }>;
}

export default async function ReceivablesPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);

  const params = await searchParams;
  const asOf = params.asOf ?? new Date().toISOString().slice(0, 10);

  const report = await AccountingQueryService.getReceivablesAging(
    session.user.organizationId,
    new Date(asOf),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounts Receivable Aging</h1>
        <p className="text-muted-foreground">Outstanding customer balances by age</p>
      </div>
      <AgingReportClient title="Customer" rows={report.rows} total={report.total} asOf={asOf} />
    </div>
  );
}

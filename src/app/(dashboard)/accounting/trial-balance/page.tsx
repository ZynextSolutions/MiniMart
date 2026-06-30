import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { TrialBalanceClient } from "@/features/accounting/components/trial-balance-client";

interface Props {
  searchParams: Promise<{ asOf?: string }>;
}

export default async function TrialBalancePage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);

  const params = await searchParams;
  const asOf = params.asOf ?? new Date().toISOString().slice(0, 10);

  const report = await AccountingQueryService.getTrialBalance(
    session.user.organizationId,
    new Date(asOf),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trial Balance</h1>
        <p className="text-muted-foreground">Verify debits equal credits</p>
      </div>
      <TrialBalanceClient {...report} asOf={asOf} />
    </div>
  );
}

import { authorizeSession, requireSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { getUserBranches } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { TrialBalanceClient } from "@/features/accounting/components/trial-balance-client";

interface Props {
  searchParams: Promise<{ asOf?: string; branchId?: string }>;
}

export default async function TrialBalancePage({ searchParams }: Props) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);

  const params = await searchParams;
  const asOf = params.asOf ?? new Date().toISOString().slice(0, 10);
  const branchId = resolveSessionBranchFilter(session.user, params.branchId);
  const branches = await getUserBranches(session.user.id);

  const report = await AccountingQueryService.getTrialBalance(
    session.user.organizationId,
    new Date(asOf),
    branchId,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trial Balance</h1>
        <p className="text-muted-foreground">Verify debits equal credits</p>
      </div>
      <TrialBalanceClient
        {...report}
        asOf={asOf}
        defaultBranchId={params.branchId ?? session.user.branchId ?? undefined}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}

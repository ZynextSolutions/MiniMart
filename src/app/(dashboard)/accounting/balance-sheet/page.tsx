import { authorizeSession, requireSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { getUserBranches } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { BalanceSheetClient } from "@/features/accounting/components/balance-sheet-client";

interface Props {
  searchParams: Promise<{ asOf?: string; branchId?: string }>;
}

export default async function BalanceSheetPage({ searchParams }: Props) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);

  const params = await searchParams;
  const asOf = params.asOf ?? new Date().toISOString().slice(0, 10);
  const branchId = resolveSessionBranchFilter(session.user, params.branchId);
  const branches = await getUserBranches(session.user.id);

  const report = await AccountingQueryService.getBalanceSheet(
    session.user.organizationId,
    new Date(asOf),
    branchId,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Balance Sheet</h1>
        <p className="text-muted-foreground">Assets, liabilities, and equity</p>
      </div>
      <BalanceSheetClient
        {...report}
        asOf={asOf}
        defaultBranchId={params.branchId ?? session.user.branchId ?? undefined}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}

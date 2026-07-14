import { authorizeSession, requireSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { getUserBranches } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { CashFlowClient } from "@/features/accounting/components/cash-flow-client";

interface Props {
  searchParams: Promise<{ from?: string; to?: string; branchId?: string }>;
}

export default async function CashFlowPage({ searchParams }: Props) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const from = params.from ?? yearStart;
  const to = params.to ?? today;
  const branchId = resolveSessionBranchFilter(session.user, params.branchId);
  const branches = await getUserBranches(session.user.id);

  const report = await AccountingQueryService.getCashFlow(
    session.user.organizationId,
    new Date(from),
    new Date(to),
    branchId,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cash Flow Statement</h1>
        <p className="text-muted-foreground">Cash movement by activity type</p>
      </div>
      <CashFlowClient
        {...report}
        from={from}
        to={to}
        defaultBranchId={params.branchId ?? session.user.branchId ?? undefined}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}

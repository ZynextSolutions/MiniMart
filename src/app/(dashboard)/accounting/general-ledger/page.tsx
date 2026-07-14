import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { GlPageClient } from "@/features/accounting/components/gl-page-client";

interface Props {
  searchParams: Promise<{ accountId?: string; from?: string; to?: string }>;
}

export default async function GeneralLedgerPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const from = params.from ?? yearStart;
  const to = params.to ?? today;

  const accounts = await AccountingQueryService.listPostableAccounts(session.user.organizationId);

  const entries = params.accountId
    ? await AccountingQueryService.getGeneralLedger(
        session.user.organizationId,
        params.accountId,
        new Date(from),
        new Date(to),
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">General Ledger</h1>
        <p className="text-muted-foreground">Account-level transaction detail</p>
      </div>
      <GlPageClient
        accounts={accounts}
        entries={entries}
        selectedAccountId={params.accountId}
        from={from}
        to={to}
      />
    </div>
  );
}

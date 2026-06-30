import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { JournalPageClient } from "@/features/accounting/components/journal-page-client";

export default async function JournalPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);

  const [entries, accounts] = await Promise.all([
    AccountingQueryService.listJournalEntries(session.user.organizationId),
    AccountingQueryService.listPostableAccounts(session.user.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Journal Entries</h1>
        <p className="text-muted-foreground">View and create manual journal entries</p>
      </div>
      <JournalPageClient entries={entries} accounts={accounts} />
    </div>
  );
}

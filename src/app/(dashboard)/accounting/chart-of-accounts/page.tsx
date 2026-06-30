import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { CoaPageClient } from "@/features/accounting/components/coa-page-client";

export default async function ChartOfAccountsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.ACCOUNTING.COA_VIEW);

  const accounts = await AccountingQueryService.listAccounts(session.user.organizationId);
  const tree = AccountingQueryService.buildAccountTree(accounts);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
        <p className="text-muted-foreground">Manage your account hierarchy</p>
      </div>
      <CoaPageClient
        tree={tree}
        parentOptions={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))}
      />
    </div>
  );
}

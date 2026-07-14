import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { BankPageClient } from "@/features/accounting/components/bank-page-client";

interface Props {
  searchParams: Promise<{ bankAccountId?: string }>;
}

export default async function BankPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.ACCOUNTING.BANK_MANAGE);

  const params = await searchParams;
  const bankAccounts = await AccountingQueryService.listBankAccounts(session.user.organizationId);
  const selectedId = params.bankAccountId ?? bankAccounts[0]?.id;

  const transactions = selectedId
    ? await AccountingQueryService.listBankTransactions(session.user.organizationId, selectedId)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bank Accounts</h1>
        <p className="text-muted-foreground">Manage bank accounts and reconciliation</p>
      </div>
      <BankPageClient
        bankAccounts={bankAccounts}
        transactions={transactions}
        selectedBankAccountId={selectedId}
      />
    </div>
  );
}

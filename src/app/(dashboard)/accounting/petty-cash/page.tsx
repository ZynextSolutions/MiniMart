import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/infrastructure/database/prisma";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { PettyCashPageClient } from "@/features/accounting/components/petty-cash-page-client";

export default async function PettyCashPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.ACCOUNTING.EXPENSE_CREATE);

  const [pettyCash, expenseAccounts] = await Promise.all([
    Promise.all([
      AccountingQueryService.getPettyCashBalance(session.user.organizationId),
      AccountingQueryService.getPettyCashTransactions(session.user.organizationId),
    ]),
    prisma.account.findMany({
      where: {
        organizationId: session.user.organizationId,
        type: "EXPENSE",
        deletedAt: null,
        isActive: true,
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const [balance, transactions] = pettyCash;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Petty Cash</h1>
        <p className="text-muted-foreground">Track petty cash fund and expenses</p>
      </div>
      <PettyCashPageClient
        balance={balance.balance}
        transactions={transactions}
        expenseAccounts={expenseAccounts}
      />
    </div>
  );
}

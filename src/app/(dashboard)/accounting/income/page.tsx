import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/infrastructure/database/prisma";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { IncomePageClient } from "@/features/accounting/components/income-page-client";

export default async function IncomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.ACCOUNTING.INCOME_CREATE);

  const [incomes, incomeAccounts] = await Promise.all([
    AccountingQueryService.listIncomes(session.user.organizationId),
    prisma.account.findMany({
      where: {
        organizationId: session.user.organizationId,
        type: "REVENUE",
        deletedAt: null,
        isActive: true,
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Other Income</h1>
        <p className="text-muted-foreground">Record non-sales income</p>
      </div>
      <IncomePageClient incomes={incomes} incomeAccounts={incomeAccounts} />
    </div>
  );
}

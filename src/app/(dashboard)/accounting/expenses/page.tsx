import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/infrastructure/database/prisma";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { ExpensesPageClient } from "@/features/accounting/components/expenses-page-client";

export default async function ExpensesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.ACCOUNTING.EXPENSE_CREATE);

  const [expenses, expenseAccounts] = await Promise.all([
    AccountingQueryService.listExpenses(session.user.organizationId),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
        <p className="text-muted-foreground">Record and track business expenses</p>
      </div>
      <ExpensesPageClient expenses={expenses} expenseAccounts={expenseAccounts} />
    </div>
  );
}

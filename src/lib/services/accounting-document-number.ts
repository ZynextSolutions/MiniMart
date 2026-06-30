import { prisma } from "@/infrastructure/database/prisma";

type AccountingDocPrefix = "EXP" | "INC";

export async function generateAccountingDocumentNumber(
  prefix: AccountingDocPrefix,
  organizationId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;

  if (prefix === "EXP") {
    const last = await prisma.expense.findFirst({
      where: { organizationId, expenseNumber: { startsWith: pattern } },
      orderBy: { expenseNumber: "desc" },
      select: { expenseNumber: true },
    });
    const seq = last ? parseInt(last.expenseNumber.slice(-5), 10) + 1 : 1;
    return `${pattern}${String(seq).padStart(5, "0")}`;
  }

  const last = await prisma.income.findFirst({
    where: { organizationId, incomeNumber: { startsWith: pattern } },
    orderBy: { incomeNumber: "desc" },
    select: { incomeNumber: true },
  });
  const seq = last ? parseInt(last.incomeNumber.slice(-5), 10) + 1 : 1;
  return `${pattern}${String(seq).padStart(5, "0")}`;
}

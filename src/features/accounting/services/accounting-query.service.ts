import { prisma } from "@/infrastructure/database/prisma";
import { AccountingEngine } from "@/lib/services/accounting-engine";
import { add, sub, toDecimal, ZERO } from "@/lib/utils/decimal";
import type { AccountType, DocumentStatus } from "@prisma/client";

export interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string;
  normalBalance: string;
  isSystem: boolean;
  isActive: boolean;
  isBankAccount: boolean;
  parentId: string | null;
  children: AccountTreeNode[];
}

export interface SerializedJournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  status: DocumentStatus;
  isAutoPosted: boolean;
  referenceType: string | null;
  lines: {
    debit: number;
    credit: number;
    account: { code: string; name: string };
  }[];
}

export class AccountingQueryService {
  static async listAccounts(organizationId: string) {
    const accounts = await prisma.account.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { code: "asc" },
      include: { parent: { select: { id: true, name: true, code: true } } },
    });
    return accounts;
  }

  static buildAccountTree(
    accounts: Awaited<ReturnType<typeof this.listAccounts>>,
  ): AccountTreeNode[] {
    const map = new Map<string, AccountTreeNode>();
    for (const a of accounts) {
      map.set(a.id, {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        normalBalance: a.normalBalance,
        isSystem: a.isSystem,
        isActive: a.isActive,
        isBankAccount: a.isBankAccount,
        parentId: a.parentId,
        children: [],
      });
    }

    const roots: AccountTreeNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  static async listPostableAccounts(organizationId: string) {
    return prisma.account.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true },
    });
  }

  static async listJournalEntries(
    organizationId: string,
    filters?: {
      status?: DocumentStatus;
      from?: Date;
      to?: Date;
      search?: string;
    },
  ): Promise<SerializedJournalEntry[]> {
    const entries = await prisma.journalEntry.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.from || filters?.to
          ? {
              entryDate: {
                ...(filters.from && { gte: filters.from }),
                ...(filters.to && { lte: filters.to }),
              },
            }
          : {}),
        ...(filters?.search && {
          OR: [
            { entryNumber: { contains: filters.search, mode: "insensitive" as const } },
            { description: { contains: filters.search, mode: "insensitive" as const } },
          ],
        }),
      },
      include: {
        lines: {
          include: { account: { select: { code: true, name: true } } },
          orderBy: { lineOrder: "asc" },
        },
      },
      orderBy: { entryDate: "desc" },
      take: 200,
    });

    return entries.map((entry) => ({
      id: entry.id,
      entryNumber: entry.entryNumber,
      entryDate: entry.entryDate.toISOString(),
      description: entry.description,
      status: entry.status,
      isAutoPosted: entry.isAutoPosted,
      referenceType: entry.referenceType,
      lines: entry.lines.map((line) => ({
        debit: Number(line.debit),
        credit: Number(line.credit),
        account: line.account,
      })),
    }));
  }

  static async getJournalEntry(id: string, organizationId: string) {
    return prisma.journalEntry.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        lines: {
          include: { account: true },
          orderBy: { lineOrder: "asc" },
        },
      },
    });
  }

  static async getTrialBalance(organizationId: string, asOf: Date) {
    return AccountingEngine.getTrialBalance(organizationId, asOf);
  }

  static async getGeneralLedger(
    organizationId: string,
    accountId: string,
    from: Date,
    to: Date,
  ) {
    return AccountingEngine.getGeneralLedger(organizationId, accountId, from, to);
  }

  static async getBalanceSheet(organizationId: string, asOf: Date) {
    return AccountingEngine.getBalanceSheet(organizationId, asOf);
  }

  static async getProfitAndLoss(organizationId: string, from: Date, to: Date) {
    return AccountingEngine.getProfitAndLoss(organizationId, from, to);
  }

  static async getCashFlow(organizationId: string, from: Date, to: Date) {
    return AccountingEngine.getCashFlow(organizationId, from, to);
  }

  static async getReceivablesAging(organizationId: string, asOf: Date) {
    const customers = await prisma.customer.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        ledgerEntries: {
          where: { entryDate: { lte: asOf } },
          orderBy: { entryDate: "desc" },
          take: 1,
        },
      },
    });

    const rows = customers
      .map((c) => {
        const latest = c.ledgerEntries[0];
        const balance = latest ? Number(latest.balance) : 0;
        if (balance <= 0) return null;

        const daysOld = latest
          ? Math.floor((asOf.getTime() - latest.entryDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          customerId: c.id,
          code: c.code,
          name: c.name,
          balance,
          current: daysOld <= 30 ? balance : 0,
          days31to60: daysOld > 30 && daysOld <= 60 ? balance : 0,
          days61to90: daysOld > 60 && daysOld <= 90 ? balance : 0,
          over90: daysOld > 90 ? balance : 0,
        };
      })
      .filter(Boolean) as {
      customerId: string;
      code: string;
      name: string;
      balance: number;
      current: number;
      days31to60: number;
      days61to90: number;
      over90: number;
    }[];

    return {
      rows,
      total: rows.reduce((s, r) => s + r.balance, 0),
    };
  }

  static async getPayablesAging(organizationId: string, asOf: Date) {
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        ledgerEntries: {
          where: { entryDate: { lte: asOf } },
          orderBy: { entryDate: "desc" },
          take: 1,
        },
      },
    });

    const rows = suppliers
      .map((s) => {
        const latest = s.ledgerEntries[0];
        const balance = latest ? Number(latest.balance) : 0;
        if (balance <= 0) return null;

        const daysOld = latest
          ? Math.floor((asOf.getTime() - latest.entryDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          supplierId: s.id,
          code: s.code,
          name: s.name,
          balance,
          current: daysOld <= 30 ? balance : 0,
          days31to60: daysOld > 30 && daysOld <= 60 ? balance : 0,
          days61to90: daysOld > 60 && daysOld <= 90 ? balance : 0,
          over90: daysOld > 90 ? balance : 0,
        };
      })
      .filter(Boolean) as {
      supplierId: string;
      code: string;
      name: string;
      balance: number;
      current: number;
      days31to60: number;
      days61to90: number;
      over90: number;
    }[];

    return {
      rows,
      total: rows.reduce((s, r) => s + r.balance, 0),
    };
  }

  static async listExpenses(organizationId: string) {
    const expenses = await prisma.expense.findMany({
      where: { organizationId },
      orderBy: { expenseDate: "desc" },
      take: 200,
    });

    return expenses.map((expense) => ({
      id: expense.id,
      expenseNumber: expense.expenseNumber,
      expenseDate: expense.expenseDate.toISOString(),
      description: expense.description,
      amount: Number(expense.amount),
      paymentMethod: expense.paymentMethod,
    }));
  }

  static async listIncomes(organizationId: string) {
    const incomes = await prisma.income.findMany({
      where: { organizationId },
      orderBy: { incomeDate: "desc" },
      take: 200,
    });

    return incomes.map((income) => ({
      id: income.id,
      incomeNumber: income.incomeNumber,
      incomeDate: income.incomeDate.toISOString(),
      description: income.description,
      amount: Number(income.amount),
    }));
  }

  static async listBankAccounts(organizationId: string) {
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { isActive: true, account: { organizationId } },
      include: { account: { select: { code: true, name: true } } },
      orderBy: { bankName: "asc" },
    });

    return Promise.all(
      bankAccounts.map(async (ba) => {
        const lines = await prisma.journalLine.findMany({
          where: {
            accountId: ba.accountId,
            journalEntry: { organizationId, status: "COMPLETED", deletedAt: null },
          },
        });
        const balance = lines.reduce(
          (sum, l) => add(sum, sub(l.debit, l.credit)),
          ZERO,
        );
        return {
          id: ba.id,
          bankName: ba.bankName,
          accountNumber: ba.accountNumber,
          accountName: ba.accountName,
          currency: ba.currency,
          balance: Number(balance),
          account: ba.account,
        };
      }),
    );
  }

  static async listBankTransactions(organizationId: string, bankAccountId: string) {
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId,
        bankAccount: { account: { organizationId, deletedAt: null } },
      },
      orderBy: { transactionDate: "desc" },
      take: 200,
    });

    return transactions.map((transaction) => ({
      id: transaction.id,
      transactionDate: transaction.transactionDate.toISOString(),
      description: transaction.description,
      debit: Number(transaction.debit),
      credit: Number(transaction.credit),
      balance: Number(transaction.balance),
      isReconciled: transaction.isReconciled,
    }));
  }

  static async listFiscalYears(organizationId: string) {
    const fiscalYears = await prisma.fiscalYear.findMany({
      where: { organizationId },
      include: { periods: { orderBy: { startDate: "asc" } } },
      orderBy: { startDate: "desc" },
    });

    return fiscalYears.map((fy) => ({
      id: fy.id,
      name: fy.name,
      startDate: fy.startDate.toISOString(),
      endDate: fy.endDate.toISOString(),
      isClosed: fy.isClosed,
      periods: fy.periods.map((period) => ({
        id: period.id,
        name: period.name,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        isClosed: period.isClosed,
      })),
    }));
  }

  static async getPettyCashBalance(organizationId: string) {
    const account = await prisma.account.findFirst({
      where: {
        organizationId,
        code: "1110",
        deletedAt: null,
      },
    });
    if (!account) return { balance: 0, accountId: null };

    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: { organizationId, status: "COMPLETED", deletedAt: null },
      },
    });
    const balance = lines.reduce(
      (sum, l) => add(sum, sub(l.debit, l.credit)),
      ZERO,
    );
    return { balance: Number(balance), accountId: account.id };
  }

  static async getPettyCashTransactions(organizationId: string) {
    const account = await prisma.account.findFirst({
      where: { organizationId, code: "1110", deletedAt: null },
    });
    if (!account) return [];

    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: { organizationId, status: "COMPLETED", deletedAt: null },
      },
      include: {
        journalEntry: {
          select: { entryNumber: true, entryDate: true, description: true, referenceType: true },
        },
      },
      orderBy: [{ journalEntry: { entryDate: "desc" } }],
      take: 100,
    });

    return lines.map((l) => ({
      id: l.id,
      entryNumber: l.journalEntry.entryNumber,
      entryDate: l.journalEntry.entryDate,
      description: l.description ?? l.journalEntry.description,
      referenceType: l.journalEntry.referenceType,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }));
  }
}

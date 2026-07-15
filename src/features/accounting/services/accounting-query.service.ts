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

  static async getTrialBalance(
    organizationId: string,
    asOf: Date,
    branchId?: string | { in: string[] },
  ) {
    return AccountingEngine.getTrialBalance(organizationId, asOf, branchId);
  }

  static async getGeneralLedger(
    organizationId: string,
    accountId: string,
    from: Date,
    to: Date,
  ) {
    return AccountingEngine.getGeneralLedger(organizationId, accountId, from, to);
  }

  static async getBalanceSheet(
    organizationId: string,
    asOf: Date,
    branchId?: string | { in: string[] },
  ) {
    return AccountingEngine.getBalanceSheet(organizationId, asOf, branchId);
  }

  static async getProfitAndLoss(
    organizationId: string,
    from: Date,
    to: Date,
    branchId?: string | { in: string[] },
  ) {
    return AccountingEngine.getProfitAndLoss(organizationId, from, to, branchId);
  }

  static async getCashFlow(
    organizationId: string,
    from: Date,
    to: Date,
    branchId?: string | { in: string[] },
  ) {
    return AccountingEngine.getCashFlow(organizationId, from, to, branchId);
  }

  static async getReceivablesAging(organizationId: string, asOf: Date) {
    const creditSales = await prisma.sale.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: "COMPLETED",
        saleType: "SALE",
        customerId: { not: null },
        saleDate: { lte: asOf },
        payments: { some: { method: "CREDIT" } },
      },
      select: {
        id: true,
        customerId: true,
        saleDate: true,
        payments: { where: { method: "CREDIT" }, select: { amount: true } },
        returns: {
          where: {
            deletedAt: null,
            status: "COMPLETED",
            saleType: "RETURN",
            saleDate: { lte: asOf },
          },
          select: {
            payments: { where: { method: "CREDIT" }, select: { amount: true } },
          },
        },
        customer: { select: { id: true, code: true, name: true } },
      },
    });

    type CustomerBucket = {
      customerId: string;
      code: string;
      name: string;
      balance: number;
      current: number;
      days31to60: number;
      days61to90: number;
      over90: number;
    };

    const byCustomer = new Map<string, CustomerBucket>();

    for (const sale of creditSales) {
      const creditAmount = sale.payments.reduce((s, p) => s + Number(p.amount), 0);
      const returnCredit = sale.returns.reduce(
        (s, r) => s + r.payments.reduce((rs, p) => rs + Number(p.amount), 0),
        0,
      );
      const openBalance = creditAmount - returnCredit;
      if (openBalance <= 0.005 || !sale.customer) continue;

      const daysOld = Math.floor(
        (asOf.getTime() - sale.saleDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const row =
        byCustomer.get(sale.customer.id) ??
        {
          customerId: sale.customer.id,
          code: sale.customer.code,
          name: sale.customer.name,
          balance: 0,
          current: 0,
          days31to60: 0,
          days61to90: 0,
          over90: 0,
        };

      row.balance += openBalance;
      if (daysOld <= 30) row.current += openBalance;
      else if (daysOld <= 60) row.days31to60 += openBalance;
      else if (daysOld <= 90) row.days61to90 += openBalance;
      else row.over90 += openBalance;

      byCustomer.set(sale.customer.id, row);
    }

    const rows = Array.from(byCustomer.values()).filter((r) => r.balance > 0.005);

    return {
      rows,
      total: rows.reduce((s, r) => s + r.balance, 0),
    };
  }

  static async getPayablesAging(organizationId: string, asOf: Date) {
    const invoices = await prisma.supplierInvoice.findMany({
      where: {
        organizationId,
        invoiceDate: { lte: asOf },
        status: { notIn: ["CANCELLED", "VOID"] },
      },
      select: {
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        supplier: { select: { id: true, code: true, name: true } },
      },
    });

    type SupplierBucket = {
      supplierId: string;
      code: string;
      name: string;
      balance: number;
      current: number;
      days31to60: number;
      days61to90: number;
      over90: number;
    };

    const bySupplier = new Map<string, SupplierBucket>();

    for (const invoice of invoices) {
      const openBalance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
      if (openBalance <= 0.005) continue;

      const daysPastDue = Math.floor(
        (asOf.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const row =
        bySupplier.get(invoice.supplier.id) ??
        {
          supplierId: invoice.supplier.id,
          code: invoice.supplier.code,
          name: invoice.supplier.name,
          balance: 0,
          current: 0,
          days31to60: 0,
          days61to90: 0,
          over90: 0,
        };

      row.balance += openBalance;
      if (daysPastDue <= 30) row.current += openBalance;
      else if (daysPastDue <= 60) row.days31to60 += openBalance;
      else if (daysPastDue <= 90) row.days61to90 += openBalance;
      else row.over90 += openBalance;

      bySupplier.set(invoice.supplier.id, row);
    }

    const rows = Array.from(bySupplier.values()).filter((r) => r.balance > 0.005);

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

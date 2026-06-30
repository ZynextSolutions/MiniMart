import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import { AccountingEngine } from "@/lib/services/accounting-engine";
import { generateAccountingDocumentNumber } from "@/lib/services/accounting-document-number";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import type { AccountSubtype, AccountType, PaymentMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

interface ServiceContext {
  organizationId: string;
  branchId: string;
  userId: string;
}

export class AccountingService {
  // ─── Chart of Accounts ───────────────────────────────────

  static async createAccount(
    input: {
      organizationId: string;
      code: string;
      name: string;
      type: AccountType;
      subtype?: AccountSubtype;
      parentId?: string;
      description?: string;
      normalBalance?: string;
      isBankAccount?: boolean;
    },
    userId: string,
  ) {
    const existing = await prisma.account.findFirst({
      where: { organizationId: input.organizationId, code: input.code, deletedAt: null },
    });
    if (existing) throw new ConflictError(`Account code ${input.code} already exists`);

    const account = await prisma.account.create({
      data: {
        organizationId: input.organizationId,
        code: input.code,
        name: input.name,
        type: input.type,
        subtype: input.subtype ?? "OTHER",
        parentId: input.parentId,
        description: input.description,
        normalBalance: input.normalBalance ?? (input.type === "ASSET" || input.type === "EXPENSE" ? "DEBIT" : "CREDIT"),
        isBankAccount: input.isBankAccount ?? false,
        isActive: true,
      },
    });

    await AuditService.log({
      organizationId: input.organizationId,
      userId,
      action: "CREATE",
      entityType: "Account",
      entityId: account.id,
      after: account,
    });

    return account;
  }

  static async updateAccount(
    id: string,
    organizationId: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      parentId?: string | null;
    },
    userId: string,
  ) {
    const account = await prisma.account.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!account) throw new NotFoundError("Account");
    if (account.isSystem && data.isActive === false) {
      throw new ValidationError("System accounts cannot be deactivated");
    }

    const updated = await prisma.account.update({
      where: { id },
      data,
    });

    await AuditService.log({
      organizationId,
      userId,
      action: "UPDATE",
      entityType: "Account",
      entityId: id,
      before: account,
      after: updated,
    });

    return updated;
  }

  static async deleteAccount(id: string, organizationId: string, userId: string) {
    const account = await prisma.account.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!account) throw new NotFoundError("Account");
    if (account.isSystem) throw new ValidationError("System accounts cannot be deleted");

    const lineCount = await prisma.journalLine.count({ where: { accountId: id } });
    if (lineCount > 0) {
      throw new ConflictError("Account has journal entries and cannot be deleted");
    }

    const deleted = await prisma.account.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await AuditService.log({
      organizationId,
      userId,
      action: "DELETE",
      entityType: "Account",
      entityId: id,
      before: account,
    });

    return deleted;
  }

  // ─── Manual Journal ──────────────────────────────────────

  static async createManualJournal(
    input: {
      entryDate: Date;
      description: string;
      lines: { accountId: string; debit: number; credit: number; description?: string }[];
      autoApprove?: boolean;
    },
    ctx: ServiceContext,
  ) {
    return prisma.$transaction(async (tx) => {
      const entry = await AccountingEngine.postManualJournal(tx, {
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
        userId: ctx.userId,
        entryDate: input.entryDate,
        description: input.description,
        lines: input.lines,
        status: input.autoApprove ? "COMPLETED" : "PENDING",
      });

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        branchId: ctx.branchId,
        action: "CREATE",
        entityType: "JournalEntry",
        entityId: entry.id,
        after: { entryNumber: entry.entryNumber, status: entry.status },
      });

      return entry;
    });
  }

  static async approveJournal(entryId: string, ctx: ServiceContext) {
    return prisma.$transaction(async (tx) => {
      const entry = await AccountingEngine.approveManualJournal(tx, {
        entryId,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
      });

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        branchId: ctx.branchId,
        action: "APPROVE",
        entityType: "JournalEntry",
        entityId: entryId,
      });

      return entry;
    });
  }

  static async voidJournal(entryId: string, reason: string, ctx: ServiceContext) {
    return prisma.$transaction(async (tx) => {
      const reversal = await AccountingEngine.voidJournalEntry(tx, {
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
        userId: ctx.userId,
        entryId,
        reason,
      });

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        branchId: ctx.branchId,
        action: "VOID",
        entityType: "JournalEntry",
        entityId: entryId,
        after: { reason, reversalId: reversal.id },
      });

      return reversal;
    });
  }

  // ─── Expense / Income ────────────────────────────────────

  static async createExpense(
    input: {
      expenseDate: Date;
      accountId: string;
      amount: number;
      description: string;
      paymentMethod: PaymentMethod;
    },
    ctx: ServiceContext,
  ) {
    if (input.amount <= 0) throw new ValidationError("Amount must be positive");

    return prisma.$transaction(async (tx) => {
      const expenseNumber = await generateAccountingDocumentNumber("EXP", ctx.organizationId);

      const expense = await tx.expense.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: ctx.branchId,
          expenseNumber,
          expenseDate: input.expenseDate,
          accountId: input.accountId,
          amount: new Decimal(input.amount),
          description: input.description,
          paymentMethod: input.paymentMethod,
          status: "COMPLETED",
          createdById: ctx.userId,
        },
      });

      await AccountingEngine.postExpense(tx, {
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
        userId: ctx.userId,
        expenseId: expense.id,
        expenseDate: input.expenseDate,
        expenseAccountId: input.accountId,
        amount: input.amount,
        description: input.description,
        paymentMethod: input.paymentMethod,
      });

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        branchId: ctx.branchId,
        action: "CREATE",
        entityType: "Expense",
        entityId: expense.id,
        after: { expenseNumber, amount: input.amount },
      });

      return expense;
    });
  }

  static async createIncome(
    input: {
      incomeDate: Date;
      accountId: string;
      amount: number;
      description: string;
      paymentAccountCode?: string;
    },
    ctx: ServiceContext,
  ) {
    if (input.amount <= 0) throw new ValidationError("Amount must be positive");

    return prisma.$transaction(async (tx) => {
      const incomeNumber = await generateAccountingDocumentNumber("INC", ctx.organizationId);

      const income = await tx.income.create({
        data: {
          organizationId: ctx.organizationId,
          incomeNumber,
          incomeDate: input.incomeDate,
          accountId: input.accountId,
          amount: new Decimal(input.amount),
          description: input.description,
          createdById: ctx.userId,
        },
      });

      await AccountingEngine.postIncome(tx, {
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
        userId: ctx.userId,
        incomeId: income.id,
        incomeDate: input.incomeDate,
        incomeAccountId: input.accountId,
        amount: input.amount,
        description: input.description,
        paymentAccountCode: input.paymentAccountCode,
      });

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "CREATE",
        entityType: "Income",
        entityId: income.id,
        after: { incomeNumber, amount: input.amount },
      });

      return income;
    });
  }

  // ─── Bank ────────────────────────────────────────────────

  static async createBankAccount(
    input: {
      organizationId: string;
      code: string;
      accountName: string;
      bankName: string;
      accountNumber: string;
      currency?: string;
    },
    userId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          organizationId: input.organizationId,
          code: input.code,
          name: input.accountName,
          type: "ASSET",
          subtype: "BANK",
          normalBalance: "DEBIT",
          isBankAccount: true,
          isActive: true,
        },
      });

      const bankAccount = await tx.bankAccount.create({
        data: {
          accountId: account.id,
          bankName: input.bankName,
          accountNumber: input.accountNumber,
          accountName: input.accountName,
          currency: input.currency ?? "THB",
        },
      });

      await AuditService.log({
        organizationId: input.organizationId,
        userId,
        action: "CREATE",
        entityType: "BankAccount",
        entityId: bankAccount.id,
        after: bankAccount,
      });

      return bankAccount;
    });
  }

  static async createBankTransaction(
    input: {
      bankAccountId: string;
      transactionDate: Date;
      description: string;
      debit: number;
      credit: number;
    },
    ctx: ServiceContext,
  ) {
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: input.bankAccountId,
        account: { organizationId: ctx.organizationId, deletedAt: null },
      },
      include: { account: true },
    });
    if (!bankAccount) throw new NotFoundError("Bank account");

    const existing = await prisma.bankTransaction.findMany({
      where: { bankAccountId: input.bankAccountId },
      orderBy: { transactionDate: "desc" },
      take: 1,
    });
    const prevBalance = existing[0] ? Number(existing[0].balance) : 0;
    const balance = prevBalance + input.debit - input.credit;

    return prisma.$transaction(async (tx) => {
      const transaction = await tx.bankTransaction.create({
        data: {
          bankAccountId: input.bankAccountId,
          transactionDate: input.transactionDate,
          description: input.description,
          debit: new Decimal(input.debit),
          credit: new Decimal(input.credit),
          balance: new Decimal(balance),
        },
      });

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "CREATE",
        entityType: "BankTransaction",
        entityId: transaction.id,
        after: transaction,
      });

      return transaction;
    });
  }

  static async reconcileBankTransaction(transactionId: string, ctx: ServiceContext) {
    const transaction = await prisma.bankTransaction.findFirst({
      where: {
        id: transactionId,
        bankAccount: { account: { organizationId: ctx.organizationId, deletedAt: null } },
      },
    });
    if (!transaction) throw new NotFoundError("Bank transaction");
    if (transaction.isReconciled) throw new ConflictError("Already reconciled");

    const updated = await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: { isReconciled: true },
    });

    await AuditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "RECONCILE",
      entityType: "BankTransaction",
      entityId: transactionId,
    });

    return updated;
  }

  // ─── Fiscal Year / Period Close ──────────────────────────

  static async createFiscalYear(
    input: {
      organizationId: string;
      name: string;
      startDate: Date;
      endDate: Date;
    },
    userId: string,
  ) {
    const fiscalYear = await prisma.fiscalYear.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });

    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    let periodStart = new Date(start.getFullYear(), start.getMonth(), 1);

    while (periodStart <= end) {
      const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
      const monthName = periodStart.toLocaleString("en", { month: "long" });

      await prisma.accountingPeriod.create({
        data: {
          fiscalYearId: fiscalYear.id,
          name: `${monthName} ${periodStart.getFullYear()}`,
          startDate: periodStart,
          endDate: periodEnd > end ? end : periodEnd,
        },
      });

      periodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1);
    }

    await AuditService.log({
      organizationId: input.organizationId,
      userId,
      action: "CREATE",
      entityType: "FiscalYear",
      entityId: fiscalYear.id,
      after: fiscalYear,
    });

    return AccountingQueryService.listFiscalYears(input.organizationId);
  }

  static async closePeriod(periodId: string, organizationId: string, userId: string) {
    const period = await prisma.accountingPeriod.findFirst({
      where: { id: periodId, fiscalYear: { organizationId } },
      include: { fiscalYear: true },
    });
    if (!period) throw new NotFoundError("Accounting period");
    if (period.isClosed) throw new ConflictError("Period is already closed");

    const pendingJournals = await prisma.journalEntry.count({
      where: {
        periodId,
        organizationId,
        status: "PENDING",
        deletedAt: null,
      },
    });
    if (pendingJournals > 0) {
      throw new ConflictError(`${pendingJournals} pending journal entries must be resolved before closing`);
    }

    const trialBalance = await AccountingEngine.getTrialBalance(
      organizationId,
      period.endDate,
    );
    if (!trialBalance.isBalanced) {
      throw new ValidationError(
        `Trial balance does not balance: debit ${trialBalance.totalDebit} vs credit ${trialBalance.totalCredit}`,
      );
    }

    const updated = await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: { isClosed: true, closedAt: new Date() },
    });

    await AuditService.log({
      organizationId,
      userId,
      action: "CLOSE",
      entityType: "AccountingPeriod",
      entityId: periodId,
    });

    return updated;
  }

  static async closeFiscalYear(fiscalYearId: string, organizationId: string, userId: string) {
    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, organizationId },
      include: { periods: true },
    });
    if (!fiscalYear) throw new NotFoundError("Fiscal year");
    if (fiscalYear.isClosed) throw new ConflictError("Fiscal year is already closed");

    const openPeriods = fiscalYear.periods.filter((p) => !p.isClosed);
    if (openPeriods.length > 0) {
      throw new ConflictError(`${openPeriods.length} periods must be closed first`);
    }

    const updated = await prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: { isClosed: true, closedAt: new Date() },
    });

    await AuditService.log({
      organizationId,
      userId,
      action: "CLOSE",
      entityType: "FiscalYear",
      entityId: fiscalYearId,
    });

    return updated;
  }

  // ─── Petty Cash ──────────────────────────────────────────

  static async recordPettyCashExpense(
    input: {
      expenseDate: Date;
      amount: number;
      description: string;
      expenseAccountId: string;
    },
    ctx: ServiceContext,
  ) {
    if (input.amount <= 0) throw new ValidationError("Amount must be positive");

    return prisma.$transaction(async (tx) => {
      const expenseNumber = await generateAccountingDocumentNumber("EXP", ctx.organizationId);

      const expense = await tx.expense.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: ctx.branchId,
          expenseNumber,
          expenseDate: input.expenseDate,
          accountId: input.expenseAccountId,
          amount: new Decimal(input.amount),
          description: input.description,
          paymentMethod: "CASH",
          status: "COMPLETED",
          createdById: ctx.userId,
        },
      });

      await AccountingEngine.postExpense(tx, {
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
        userId: ctx.userId,
        expenseId: expense.id,
        expenseDate: input.expenseDate,
        expenseAccountId: input.expenseAccountId,
        amount: input.amount,
        description: input.description,
        paymentMethod: "CASH",
        paymentAccountCode: "1110",
      });

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        branchId: ctx.branchId,
        action: "CREATE",
        entityType: "PettyCashExpense",
        entityId: expense.id,
        after: { expenseNumber, amount: input.amount },
      });

      return expense;
    });
  }
}

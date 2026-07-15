"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, requireModuleSession, authorizeSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getErrorMessage } from "@/lib/errors/app-error";
import { AccountingService } from "@/features/accounting/services/accounting-service";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import type { AccountSubtype, AccountType, DocumentStatus, PaymentMethod } from "@prisma/client";

function ctx(session: Awaited<ReturnType<typeof requireSession>>) {
  if (!session.user.branchId) throw new Error("No branch selected");
  return {
    organizationId: session.user.organizationId,
    branchId: session.user.branchId,
    userId: session.user.id,
  };
}

async function requireAccountingSession(permission: string) {
  const session = await requireModuleSession("accounting");
  await authorizeSession(session, permission);
  return session;
}

const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().nonnegative(),
  credit: z.number().nonnegative(),
  description: z.string().optional(),
});

// ─── Chart of Accounts ─────────────────────────────────────

export async function listAccountsAction() {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.COA_VIEW);
  const accounts = await AccountingQueryService.listAccounts(session.user.organizationId);
  return {
    accounts,
    tree: AccountingQueryService.buildAccountTree(accounts),
  };
}

export async function listPostableAccountsAction() {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);
  return AccountingQueryService.listPostableAccounts(session.user.organizationId);
}

export async function createAccountAction(input: {
  code: string;
  name: string;
  type: AccountType;
  subtype?: AccountSubtype;
  parentId?: string;
  description?: string;
}) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.COA_MANAGE);
    const account = await AccountingService.createAccount(
      { ...input, organizationId: session.user.organizationId },
      session.user.id,
    );
    revalidatePath("/accounting/chart-of-accounts");
    return { success: true, account };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateAccountAction(input: {
  id: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  parentId?: string | null;
}) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.COA_MANAGE);
    const { id, ...data } = input;
    const account = await AccountingService.updateAccount(
      id,
      session.user.organizationId,
      data,
      session.user.id,
    );
    revalidatePath("/accounting/chart-of-accounts");
    return { success: true, account };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function deleteAccountAction(id: string) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.COA_MANAGE);
    await AccountingService.deleteAccount(id, session.user.organizationId, session.user.id);
    revalidatePath("/accounting/chart-of-accounts");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Journal Entries ───────────────────────────────────────

export async function listJournalEntriesAction(filters?: {
  status?: DocumentStatus;
  from?: string;
  to?: string;
  search?: string;
}) {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);
  return AccountingQueryService.listJournalEntries(session.user.organizationId, {
    status: filters?.status,
    from: filters?.from ? new Date(filters.from) : undefined,
    to: filters?.to ? new Date(filters.to) : undefined,
    search: filters?.search,
  });
}

export async function createManualJournalAction(input: {
  entryDate: string;
  description: string;
  lines: z.infer<typeof journalLineSchema>[];
  autoApprove?: boolean;
}) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_CREATE);
    const lines = z.array(journalLineSchema).min(2).parse(input.lines);
    const entry = await AccountingService.createManualJournal(
      {
        entryDate: new Date(input.entryDate),
        description: input.description,
        lines,
        autoApprove: input.autoApprove,
      },
      ctx(session),
    );
    revalidatePath("/accounting/journal");
    return { success: true, entry };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function approveJournalAction(id: string) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_CREATE);
    const entry = await AccountingService.approveJournal(id, ctx(session));
    revalidatePath("/accounting/journal");
    return { success: true, entry };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function voidJournalAction(id: string, reason: string) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_VOID);
    await AccountingService.voidJournal(id, reason, ctx(session));
    revalidatePath("/accounting/journal");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Reports ───────────────────────────────────────────────

export async function getTrialBalanceAction(asOf: string, branchId?: string) {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);
  return AccountingQueryService.getTrialBalance(
    session.user.organizationId,
    new Date(asOf),
    resolveSessionBranchFilter(session.user, branchId),
  );
}

export async function getGeneralLedgerAction(accountId: string, from: string, to: string) {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);
  return AccountingQueryService.getGeneralLedger(
    session.user.organizationId,
    accountId,
    new Date(from),
    new Date(to),
  );
}

export async function getBalanceSheetAction(asOf: string, branchId?: string) {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);
  return AccountingQueryService.getBalanceSheet(
    session.user.organizationId,
    new Date(asOf),
    resolveSessionBranchFilter(session.user, branchId),
  );
}

export async function getProfitAndLossAction(
  from: string,
  to: string,
  branchId?: string,
) {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);
  return AccountingQueryService.getProfitAndLoss(
    session.user.organizationId,
    new Date(from),
    new Date(to),
    resolveSessionBranchFilter(session.user, branchId),
  );
}

export async function getCashFlowAction(
  from: string,
  to: string,
  branchId?: string,
) {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);
  return AccountingQueryService.getCashFlow(
    session.user.organizationId,
    new Date(from),
    new Date(to),
    resolveSessionBranchFilter(session.user, branchId),
  );
}

export async function getReceivablesAgingAction(asOf: string) {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);
  return AccountingQueryService.getReceivablesAging(
    session.user.organizationId,
    new Date(asOf),
  );
}

export async function getPayablesAgingAction(asOf: string) {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);
  return AccountingQueryService.getPayablesAging(
    session.user.organizationId,
    new Date(asOf),
  );
}

// ─── Expenses / Income ─────────────────────────────────────

export async function listExpensesAction() {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.EXPENSE_CREATE);
  return AccountingQueryService.listExpenses(session.user.organizationId);
}

export async function createExpenseAction(input: {
  expenseDate: string;
  accountId: string;
  amount: number;
  description: string;
  paymentMethod: PaymentMethod;
}) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.EXPENSE_CREATE);
    const expense = await AccountingService.createExpense(
      { ...input, expenseDate: new Date(input.expenseDate) },
      ctx(session),
    );
    revalidatePath("/accounting/expenses");
    return { success: true, expense };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function listIncomesAction() {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.INCOME_CREATE);
  return AccountingQueryService.listIncomes(session.user.organizationId);
}

export async function createIncomeAction(input: {
  incomeDate: string;
  accountId: string;
  amount: number;
  description: string;
}) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.INCOME_CREATE);
    const income = await AccountingService.createIncome(
      { ...input, incomeDate: new Date(input.incomeDate) },
      ctx(session),
    );
    revalidatePath("/accounting/income");
    return { success: true, income };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Bank ──────────────────────────────────────────────────

export async function listBankAccountsAction() {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.BANK_MANAGE);
  return AccountingQueryService.listBankAccounts(session.user.organizationId);
}

export async function createBankAccountAction(input: {
  code: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  currency?: string;
}) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.BANK_MANAGE);
    const bankAccount = await AccountingService.createBankAccount(
      { ...input, organizationId: session.user.organizationId },
      session.user.id,
    );
    revalidatePath("/accounting/bank");
    return { success: true, bankAccount };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function listBankTransactionsAction(bankAccountId: string) {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.BANK_MANAGE);
  return AccountingQueryService.listBankTransactions(
    session.user.organizationId,
    bankAccountId,
  );
}

export async function createBankTransactionAction(input: {
  bankAccountId: string;
  transactionDate: string;
  description: string;
  debit: number;
  credit: number;
}) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.BANK_MANAGE);
    const transaction = await AccountingService.createBankTransaction(
      { ...input, transactionDate: new Date(input.transactionDate) },
      ctx(session),
    );
    revalidatePath("/accounting/bank");
    return { success: true, transaction };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function reconcileBankTransactionAction(id: string) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.BANK_RECONCILE);
    await AccountingService.reconcileBankTransaction(id, ctx(session));
    revalidatePath("/accounting/bank");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Fiscal Year ───────────────────────────────────────────

export async function listFiscalYearsAction() {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.PERIOD_CLOSE);
  return AccountingQueryService.listFiscalYears(session.user.organizationId);
}

export async function createFiscalYearAction(input: {
  name: string;
  startDate: string;
  endDate: string;
}) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.PERIOD_CLOSE);
    const years = await AccountingService.createFiscalYear(
      {
        organizationId: session.user.organizationId,
        name: input.name,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      },
      session.user.id,
    );
    revalidatePath("/accounting/fiscal-year");
    return { success: true, years };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function closePeriodAction(periodId: string) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.PERIOD_CLOSE);
    await AccountingService.closePeriod(periodId, session.user.organizationId, session.user.id);
    revalidatePath("/accounting/fiscal-year");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function closeFiscalYearAction(fiscalYearId: string) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.PERIOD_CLOSE);
    await AccountingService.closeFiscalYear(fiscalYearId, session.user.organizationId, session.user.id);
    revalidatePath("/accounting/fiscal-year");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Petty Cash ────────────────────────────────────────────

export async function getPettyCashAction() {
  const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.EXPENSE_CREATE);
  const [balance, transactions] = await Promise.all([
    AccountingQueryService.getPettyCashBalance(session.user.organizationId),
    AccountingQueryService.getPettyCashTransactions(session.user.organizationId),
  ]);
  return { balance, transactions };
}

export async function recordPettyCashExpenseAction(input: {
  expenseDate: string;
  amount: number;
  description: string;
  expenseAccountId: string;
}) {
  try {
    const session = await requireAccountingSession(PERMISSIONS.ACCOUNTING.EXPENSE_CREATE);
    const expense = await AccountingService.recordPettyCashExpense(
      {
        expenseDate: new Date(input.expenseDate),
        amount: input.amount,
        description: input.description,
        expenseAccountId: input.expenseAccountId,
      },
      ctx(session),
    );
    revalidatePath("/accounting/petty-cash");
    return { success: true, expense };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

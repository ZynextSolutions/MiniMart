import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { AccountMappingService } from "@/lib/services/account-mapping-service";
import { generateSaleDocumentNumber } from "@/lib/services/sale-document-number";
import { add, sub, toDecimal, ZERO } from "@/lib/utils/decimal";
import type { AccountMapping } from "@/platform/onboarding/default-account-mapping";
import type { AccountType, PaymentMethod, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

type Tx = Prisma.TransactionClient;

interface JournalLineInput {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface PostSaleInput {
  organizationId: string;
  branchId: string;
  userId: string;
  saleId: string;
  saleDate: Date;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  totalCogs: number;
  payments: { method: PaymentMethod; amount: number }[];
  idempotencyKey?: string;
}

export class AccountingEngine {
  private static async getAccountMapping(organizationId: string): Promise<AccountMapping> {
    return AccountMappingService.getAccountMapping(organizationId);
  }

  private static async getAccountId(organizationId: string, code: string) {
    const account = await prisma.account.findFirst({
      where: { organizationId, code, deletedAt: null, isActive: true },
    });
    if (!account) throw new NotFoundError(`Account ${code}`);
    return account.id;
  }

  private static async getCurrentPeriod(organizationId: string, date: Date) {
    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: {
        organizationId,
        startDate: { lte: date },
        endDate: { gte: date },
        isClosed: false,
      },
      include: {
        periods: {
          where: {
            startDate: { lte: date },
            endDate: { gte: date },
            isClosed: false,
          },
          take: 1,
        },
      },
    });

    if (!fiscalYear?.periods[0]) {
      throw new ValidationError("No open accounting period for this date");
    }

    return { fiscalYearId: fiscalYear.id, periodId: fiscalYear.periods[0].id };
  }

  private static validateBalance(lines: JournalLineInput[]) {
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new ValidationError(
        `Unbalanced journal: debit ${totalDebit} != credit ${totalCredit}`,
      );
    }
  }

  private static paymentAccountCode(
    method: PaymentMethod,
    mapping: AccountMapping,
  ): string {
    switch (method) {
      case "CASH":
        return mapping.cash;
      case "CARD":
        return mapping.cardClearing;
      case "QR":
      case "BANK_TRANSFER":
        return mapping.bank;
      case "GIFT_CARD":
        return mapping.giftCardLiability;
      case "CREDIT":
        return mapping.accountsReceivable;
      case "LOYALTY_POINTS":
        return mapping.salesRevenue;
      default:
        return mapping.cash;
    }
  }

  static async postSale(tx: Tx, input: PostSaleInput) {
    if (input.idempotencyKey) {
      const existing = await tx.journalEntry.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: input.organizationId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) return existing;
    }

    const mapping = await this.getAccountMapping(input.organizationId);
    const { fiscalYearId, periodId } = await this.getCurrentPeriod(
      input.organizationId,
      input.saleDate,
    );

    const revenueAmount = Math.max(0, input.subtotal - input.discountAmount);
    const lines: JournalLineInput[] = [];

    for (const payment of input.payments) {
      if (payment.amount <= 0) continue;
      lines.push({
        accountCode: this.paymentAccountCode(payment.method, mapping),
        debit: payment.amount,
        credit: 0,
        description: `Sale payment (${payment.method})`,
      });
    }

    if (input.totalCogs > 0) {
      lines.push({
        accountCode: mapping.cogs,
        debit: input.totalCogs,
        credit: 0,
        description: "Cost of goods sold",
      });
      lines.push({
        accountCode: mapping.inventory,
        debit: 0,
        credit: input.totalCogs,
        description: "Inventory reduction",
      });
    }

    if (revenueAmount > 0) {
      lines.push({
        accountCode: mapping.salesRevenue,
        debit: 0,
        credit: revenueAmount,
        description: "Sales revenue",
      });
    }

    if (input.taxAmount > 0) {
      lines.push({
        accountCode: mapping.salesTaxPayable,
        debit: 0,
        credit: input.taxAmount,
        description: "Sales tax",
      });
    }

    this.validateBalance(lines);

    const entryNumber = await generateSaleDocumentNumber("JRN", input.organizationId);

    const journalEntry = await tx.journalEntry.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId,
        fiscalYearId,
        periodId,
        entryNumber,
        entryDate: input.saleDate,
        description: `Sale ${input.saleId}`,
        referenceType: "Sale",
        referenceId: input.saleId,
        status: "COMPLETED",
        isAutoPosted: true,
        idempotencyKey: input.idempotencyKey,
        createdById: input.userId,
        lines: {
          create: await Promise.all(
            lines.map(async (line, index) => ({
              accountId: await this.getAccountId(input.organizationId, line.accountCode),
              description: line.description,
              debit: new Decimal(line.debit),
              credit: new Decimal(line.credit),
              lineOrder: index,
            })),
          ),
        },
      },
    });

    return journalEntry;
  }

  static async postSaleReturn(tx: Tx, input: PostSaleInput) {
    if (input.idempotencyKey) {
      const existing = await tx.journalEntry.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: input.organizationId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) return existing;
    }

    const mapping = await this.getAccountMapping(input.organizationId);
    const { fiscalYearId, periodId } = await this.getCurrentPeriod(
      input.organizationId,
      input.saleDate,
    );

    const revenueAmount = Math.max(0, input.subtotal - input.discountAmount);
    const lines: JournalLineInput[] = [];

    for (const payment of input.payments) {
      if (payment.amount <= 0) continue;
      lines.push({
        accountCode: this.paymentAccountCode(payment.method, mapping),
        debit: 0,
        credit: payment.amount,
        description: `Refund (${payment.method})`,
      });
    }

    if (revenueAmount > 0) {
      lines.push({
        accountCode: mapping.salesRevenue,
        debit: revenueAmount,
        credit: 0,
        description: "Sales return",
      });
    }

    if (input.taxAmount > 0) {
      lines.push({
        accountCode: mapping.salesTaxPayable,
        debit: input.taxAmount,
        credit: 0,
        description: "Tax reversal",
      });
    }

    if (input.totalCogs > 0) {
      lines.push({
        accountCode: mapping.inventory,
        debit: input.totalCogs,
        credit: 0,
        description: "Inventory return",
      });
      lines.push({
        accountCode: mapping.cogs,
        debit: 0,
        credit: input.totalCogs,
        description: "COGS reversal",
      });
    }

    this.validateBalance(lines);

    const entryNumber = await generateSaleDocumentNumber("JRN", input.organizationId);

    return tx.journalEntry.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId,
        fiscalYearId,
        periodId,
        entryNumber,
        entryDate: input.saleDate,
        description: `Sale return ${input.saleId}`,
        referenceType: "SaleReturn",
        referenceId: input.saleId,
        status: "COMPLETED",
        isAutoPosted: true,
        idempotencyKey: input.idempotencyKey,
        createdById: input.userId,
        lines: {
          create: await Promise.all(
            lines.map(async (line, index) => ({
              accountId: await this.getAccountId(input.organizationId, line.accountCode),
              description: line.description,
              debit: new Decimal(line.debit),
              credit: new Decimal(line.credit),
              lineOrder: index,
            })),
          ),
        },
      },
    });
  }

  static async postPurchaseInvoice(
    tx: Tx,
    input: {
      organizationId: string;
      branchId: string;
      userId: string;
      invoiceId: string;
      invoiceDate: Date;
      subtotal: number;
      taxAmount: number;
      totalAmount: number;
    },
  ) {
    const mapping = await this.getAccountMapping(input.organizationId);
    const { fiscalYearId, periodId } = await this.getCurrentPeriod(
      input.organizationId,
      input.invoiceDate,
    );

    const lines: JournalLineInput[] = [
      {
        accountCode: mapping.inventory,
        debit: input.subtotal,
        credit: 0,
        description: "Inventory purchase",
      },
      {
        accountCode: mapping.accountsPayable,
        debit: 0,
        credit: input.totalAmount,
        description: "Accounts payable",
      },
    ];

    if (input.taxAmount > 0) {
      lines.splice(1, 0, {
        accountCode: mapping.salesTaxPayable,
        debit: input.taxAmount,
        credit: 0,
        description: "Input tax",
      });
    }

    this.validateBalance(lines);

    const entryNumber = await generateSaleDocumentNumber("JRN", input.organizationId);

    return tx.journalEntry.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId,
        fiscalYearId,
        periodId,
        entryNumber,
        entryDate: input.invoiceDate,
        description: `Supplier invoice ${input.invoiceId}`,
        referenceType: "SupplierInvoice",
        referenceId: input.invoiceId,
        status: "COMPLETED",
        isAutoPosted: true,
        createdById: input.userId,
        lines: {
          create: await Promise.all(
            lines.map(async (line, index) => ({
              accountId: await this.getAccountId(input.organizationId, line.accountCode),
              description: line.description,
              debit: new Decimal(line.debit),
              credit: new Decimal(line.credit),
              lineOrder: index,
            })),
          ),
        },
      },
    });
  }

  static async postSupplierReturn(
    tx: Tx,
    input: {
      organizationId: string;
      branchId: string;
      userId: string;
      returnId: string;
      returnDate: Date;
      totalValue: number;
    },
  ) {
    if (input.totalValue <= 0) return null;

    const mapping = await this.getAccountMapping(input.organizationId);
    const { fiscalYearId, periodId } = await this.getCurrentPeriod(
      input.organizationId,
      input.returnDate,
    );

    const lines: JournalLineInput[] = [
      {
        accountCode: mapping.accountsPayable,
        debit: input.totalValue,
        credit: 0,
        description: "Supplier return — AP reduction",
      },
      {
        accountCode: mapping.inventory,
        debit: 0,
        credit: input.totalValue,
        description: "Supplier return — inventory reduction",
      },
    ];

    this.validateBalance(lines);

    const entryNumber = await generateSaleDocumentNumber("JRN", input.organizationId);

    return tx.journalEntry.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId,
        fiscalYearId,
        periodId,
        entryNumber,
        entryDate: input.returnDate,
        description: `Supplier return ${input.returnId}`,
        referenceType: "SupplierReturn",
        referenceId: input.returnId,
        status: "COMPLETED",
        isAutoPosted: true,
        createdById: input.userId,
        lines: {
          create: await Promise.all(
            lines.map(async (line, index) => ({
              accountId: await this.getAccountId(input.organizationId, line.accountCode),
              description: line.description,
              debit: new Decimal(line.debit),
              credit: new Decimal(line.credit),
              lineOrder: index,
            })),
          ),
        },
      },
    });
  }

  static async postSupplierPayment(
    tx: Tx,
    input: {
      organizationId: string;
      branchId: string;
      userId: string;
      paymentId: string;
      paymentDate: Date;
      amount: number;
      method: "CASH" | "BANK";
    },
  ) {
    const mapping = await this.getAccountMapping(input.organizationId);
    const { fiscalYearId, periodId } = await this.getCurrentPeriod(
      input.organizationId,
      input.paymentDate,
    );

    const cashOrBank = input.method === "CASH" ? mapping.cash : mapping.bank;

    const lines: JournalLineInput[] = [
      {
        accountCode: mapping.accountsPayable,
        debit: input.amount,
        credit: 0,
        description: "Supplier payment",
      },
      {
        accountCode: cashOrBank,
        debit: 0,
        credit: input.amount,
        description: "Payment out",
      },
    ];

    this.validateBalance(lines);

    const entryNumber = await generateSaleDocumentNumber("JRN", input.organizationId);

    return tx.journalEntry.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId,
        fiscalYearId,
        periodId,
        entryNumber,
        entryDate: input.paymentDate,
        description: `Supplier payment ${input.paymentId}`,
        referenceType: "SupplierPayment",
        referenceId: input.paymentId,
        status: "COMPLETED",
        isAutoPosted: true,
        createdById: input.userId,
        lines: {
          create: await Promise.all(
            lines.map(async (line, index) => ({
              accountId: await this.getAccountId(input.organizationId, line.accountCode),
              description: line.description,
              debit: new Decimal(line.debit),
              credit: new Decimal(line.credit),
              lineOrder: index,
            })),
          ),
        },
      },
    });
  }

  static async postManualJournal(
    tx: Tx,
    input: {
      organizationId: string;
      branchId?: string;
      userId: string;
      entryDate: Date;
      description: string;
      lines: { accountId: string; debit: number; credit: number; description?: string }[];
      status?: "PENDING" | "COMPLETED";
    },
  ) {
    if (input.lines.length < 2) {
      throw new ValidationError("Journal entry requires at least 2 lines");
    }

    const journalLines: JournalLineInput[] = [];
    for (const line of input.lines) {
      const account = await tx.account.findFirst({
        where: { id: line.accountId, organizationId: input.organizationId, deletedAt: null },
      });
      if (!account) throw new NotFoundError(`Account ${line.accountId}`);
      journalLines.push({
        accountCode: account.code,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      });
    }

    this.validateBalance(journalLines);

    const status = input.status ?? "PENDING";
    const { fiscalYearId, periodId } = await this.getCurrentPeriod(
      input.organizationId,
      input.entryDate,
    );

    const entryNumber = await generateSaleDocumentNumber("JRN", input.organizationId);

    return tx.journalEntry.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId,
        fiscalYearId,
        periodId,
        entryNumber,
        entryDate: input.entryDate,
        description: input.description,
        referenceType: "ManualJournal",
        status,
        isAutoPosted: false,
        createdById: input.userId,
        lines: {
          create: input.lines.map((line, index) => ({
            accountId: line.accountId,
            description: line.description,
            debit: new Decimal(line.debit),
            credit: new Decimal(line.credit),
            lineOrder: index,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });
  }

  static async approveManualJournal(
    tx: Tx,
    input: { entryId: string; organizationId: string; userId: string },
  ) {
    const entry = await tx.journalEntry.findFirst({
      where: { id: input.entryId, organizationId: input.organizationId, deletedAt: null },
      include: { lines: true },
    });
    if (!entry) throw new NotFoundError("Journal entry");
    if (entry.status !== "PENDING") {
      throw new ConflictError("Only pending journal entries can be approved");
    }

    const { fiscalYearId, periodId } = await this.getCurrentPeriod(
      input.organizationId,
      entry.entryDate,
    );

    const lines = entry.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
    }));
    this.validateBalance(
      lines.map((l, i) => ({
        accountCode: String(i),
        debit: l.debit,
        credit: l.credit,
      })),
    );

    return tx.journalEntry.update({
      where: { id: entry.id },
      data: {
        status: "COMPLETED",
        fiscalYearId,
        periodId,
      },
      include: { lines: { include: { account: true } } },
    });
  }

  static async voidJournalEntry(
    tx: Tx,
    input: {
      organizationId: string;
      branchId?: string;
      userId: string;
      entryId: string;
      reason: string;
    },
  ) {
    const original = await tx.journalEntry.findFirst({
      where: {
        id: input.entryId,
        organizationId: input.organizationId,
        deletedAt: null,
        status: "COMPLETED",
      },
      include: { lines: true },
    });
    if (!original) throw new NotFoundError("Journal entry");
    if (original.referenceType === "VoidReversal") {
      throw new ConflictError("Cannot void a reversal entry");
    }

    const { fiscalYearId, periodId } = await this.getCurrentPeriod(
      input.organizationId,
      new Date(),
    );

    const entryNumber = await generateSaleDocumentNumber("JRN", input.organizationId);

    const reversal = await tx.journalEntry.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId ?? original.branchId,
        fiscalYearId,
        periodId,
        entryNumber,
        entryDate: new Date(),
        description: `Void: ${original.description} — ${input.reason}`,
        referenceType: "VoidReversal",
        referenceId: original.id,
        status: "COMPLETED",
        isAutoPosted: false,
        createdById: input.userId,
        lines: {
          create: original.lines.map((line, index) => ({
            accountId: line.accountId,
            description: `Reversal: ${line.description ?? ""}`,
            debit: line.credit,
            credit: line.debit,
            lineOrder: index,
          })),
        },
      },
    });

    await tx.journalEntry.update({
      where: { id: original.id },
      data: { status: "VOID" },
    });

    return reversal;
  }

  static async postExpense(
    tx: Tx,
    input: {
      organizationId: string;
      branchId: string;
      userId: string;
      expenseId: string;
      expenseDate: Date;
      expenseAccountId: string;
      amount: number;
      description: string;
      paymentMethod: PaymentMethod;
      paymentAccountCode?: string;
    },
  ) {
    const mapping = await this.getAccountMapping(input.organizationId);
    const { fiscalYearId, periodId } = await this.getCurrentPeriod(
      input.organizationId,
      input.expenseDate,
    );

    const expenseAccount = await tx.account.findFirst({
      where: { id: input.expenseAccountId, organizationId: input.organizationId },
    });
    if (!expenseAccount) throw new NotFoundError("Expense account");

    let paymentAccountCode: string;
    if (input.paymentAccountCode) {
      paymentAccountCode = input.paymentAccountCode;
    } else {
      switch (input.paymentMethod) {
        case "CASH":
          paymentAccountCode = mapping.cash;
          break;
        case "BANK_TRANSFER":
        case "CARD":
        case "QR":
          paymentAccountCode = mapping.bank;
          break;
        default:
          paymentAccountCode = mapping.cash;
      }
    }

    const lines: JournalLineInput[] = [
      {
        accountCode: expenseAccount.code,
        debit: input.amount,
        credit: 0,
        description: input.description,
      },
      {
        accountCode: paymentAccountCode,
        debit: 0,
        credit: input.amount,
        description: "Expense payment",
      },
    ];

    this.validateBalance(lines);
    const entryNumber = await generateSaleDocumentNumber("JRN", input.organizationId);

    return tx.journalEntry.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId,
        fiscalYearId,
        periodId,
        entryNumber,
        entryDate: input.expenseDate,
        description: `Expense ${input.expenseId}`,
        referenceType: "Expense",
        referenceId: input.expenseId,
        status: "COMPLETED",
        isAutoPosted: true,
        createdById: input.userId,
        lines: {
          create: await Promise.all(
            lines.map(async (line, index) => ({
              accountId: await this.getAccountId(input.organizationId, line.accountCode),
              description: line.description,
              debit: new Decimal(line.debit),
              credit: new Decimal(line.credit),
              lineOrder: index,
            })),
          ),
        },
      },
    });
  }

  static async postIncome(
    tx: Tx,
    input: {
      organizationId: string;
      branchId?: string;
      userId: string;
      incomeId: string;
      incomeDate: Date;
      incomeAccountId: string;
      amount: number;
      description: string;
      paymentAccountCode?: string;
    },
  ) {
    const mapping = await this.getAccountMapping(input.organizationId);
    const { fiscalYearId, periodId } = await this.getCurrentPeriod(
      input.organizationId,
      input.incomeDate,
    );

    const incomeAccount = await tx.account.findFirst({
      where: { id: input.incomeAccountId, organizationId: input.organizationId },
    });
    if (!incomeAccount) throw new NotFoundError("Income account");

    const lines: JournalLineInput[] = [
      {
        accountCode: input.paymentAccountCode ?? mapping.cash,
        debit: input.amount,
        credit: 0,
        description: "Income received",
      },
      {
        accountCode: incomeAccount.code,
        debit: 0,
        credit: input.amount,
        description: input.description,
      },
    ];

    this.validateBalance(lines);
    const entryNumber = await generateSaleDocumentNumber("JRN", input.organizationId);

    return tx.journalEntry.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId,
        fiscalYearId,
        periodId,
        entryNumber,
        entryDate: input.incomeDate,
        description: `Income ${input.incomeId}`,
        referenceType: "Income",
        referenceId: input.incomeId,
        status: "COMPLETED",
        isAutoPosted: true,
        createdById: input.userId,
        lines: {
          create: await Promise.all(
            lines.map(async (line, index) => ({
              accountId: await this.getAccountId(input.organizationId, line.accountCode),
              description: line.description,
              debit: new Decimal(line.debit),
              credit: new Decimal(line.credit),
              lineOrder: index,
            })),
          ),
        },
      },
    });
  }

  // ─── Reports ───────────────────────────────────────────────

  private static async aggregateAccountBalances(
    organizationId: string,
    asOf: Date,
    from?: Date,
    branchId?: string | { in: string[] },
  ) {
    const entries = await prisma.journalEntry.findMany({
      where: {
        organizationId,
        status: "COMPLETED",
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        entryDate: from
          ? { gte: from, lte: asOf }
          : { lte: asOf },
      },
      include: {
        lines: {
          include: { account: true },
        },
      },
    });

    const balances = new Map<
      string,
      {
        accountId: string;
        code: string;
        name: string;
        type: AccountType;
        normalBalance: string;
        debit: Decimal;
        credit: Decimal;
      }
    >();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const key = line.accountId;
        const existing = balances.get(key) ?? {
          accountId: line.accountId,
          code: line.account.code,
          name: line.account.name,
          type: line.account.type,
          normalBalance: line.account.normalBalance,
          debit: ZERO,
          credit: ZERO,
        };
        existing.debit = add(existing.debit, line.debit);
        existing.credit = add(existing.credit, line.credit);
        balances.set(key, existing);
      }
    }

    return Array.from(balances.values());
  }

  static async getTrialBalance(
    organizationId: string,
    asOf: Date,
    branchId?: string | { in: string[] },
  ) {
    const balances = await this.aggregateAccountBalances(
      organizationId,
      asOf,
      undefined,
      branchId,
    );
    const rows = balances
      .map((b) => {
        const netDebit = sub(b.debit, b.credit);
        const debitBalance = netDebit.gt(ZERO) ? netDebit : ZERO;
        const creditBalance = netDebit.lt(ZERO) ? netDebit.abs() : ZERO;
        return {
          accountId: b.accountId,
          code: b.code,
          name: b.name,
          type: b.type,
          debit: Number(debitBalance),
          credit: Number(creditBalance),
        };
      })
      .filter((r) => r.debit > 0 || r.credit > 0)
      .sort((a, b) => a.code.localeCompare(b.code));

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

    return { rows, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }

  static async getGeneralLedger(
    organizationId: string,
    accountId: string,
    from: Date,
    to: Date,
  ) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, organizationId, deletedAt: null },
    });
    if (!account) throw new NotFoundError("Account");

    const lines = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          organizationId,
          status: "COMPLETED",
          deletedAt: null,
          entryDate: { gte: from, lte: to },
        },
      },
      include: {
        journalEntry: { select: { entryNumber: true, entryDate: true, description: true } },
      },
      orderBy: [{ journalEntry: { entryDate: "asc" } }, { lineOrder: "asc" }],
    });

    let runningBalance = ZERO;
    return lines.map((line) => {
      const debit = toDecimal(line.debit);
      const credit = toDecimal(line.credit);
      if (account.normalBalance === "DEBIT") {
        runningBalance = add(runningBalance, sub(debit, credit));
      } else {
        runningBalance = add(runningBalance, sub(credit, debit));
      }
      return {
        id: line.id,
        entryNumber: line.journalEntry.entryNumber,
        entryDate: line.journalEntry.entryDate,
        description: line.description ?? line.journalEntry.description,
        debit: Number(debit),
        credit: Number(credit),
        balance: Number(runningBalance),
      };
    });
  }

  static async getBalanceSheet(
    organizationId: string,
    asOf: Date,
    branchId?: string | { in: string[] },
  ) {
    const balances = await this.aggregateAccountBalances(
      organizationId,
      asOf,
      undefined,
      branchId,
    );

    function sectionTotal(type: AccountType) {
      return balances
        .filter((b) => b.type === type)
        .reduce((sum, b) => {
          const net =
            b.normalBalance === "DEBIT"
              ? sub(b.debit, b.credit)
              : sub(b.credit, b.debit);
          return add(sum, net);
        }, ZERO);
    }

    const assets = sectionTotal("ASSET");
    const liabilities = sectionTotal("LIABILITY");
    const equity = sectionTotal("EQUITY");

    const sections = {
      assets: balances
        .filter((b) => b.type === "ASSET")
        .map((b) => ({
          code: b.code,
          name: b.name,
          balance: Number(
            b.normalBalance === "DEBIT" ? sub(b.debit, b.credit) : sub(b.credit, b.debit),
          ),
        }))
        .filter((r) => r.balance !== 0),
      liabilities: balances
        .filter((b) => b.type === "LIABILITY")
        .map((b) => ({
          code: b.code,
          name: b.name,
          balance: Number(sub(b.credit, b.debit)),
        }))
        .filter((r) => r.balance !== 0),
      equity: balances
        .filter((b) => b.type === "EQUITY")
        .map((b) => ({
          code: b.code,
          name: b.name,
          balance: Number(sub(b.credit, b.debit)),
        }))
        .filter((r) => r.balance !== 0),
    };

    return {
      sections,
      totalAssets: Number(assets),
      totalLiabilities: Number(liabilities),
      totalEquity: Number(equity),
      totalLiabilitiesAndEquity: Number(add(liabilities, equity)),
    };
  }

  static async getProfitAndLoss(
    organizationId: string,
    from: Date,
    to: Date,
    branchId?: string | { in: string[] },
  ) {
    const balances = await this.aggregateAccountBalances(
      organizationId,
      to,
      from,
      branchId,
    );

    const revenue = balances
      .filter((b) => b.type === "REVENUE")
      .reduce((sum, b) => add(sum, sub(b.credit, b.debit)), ZERO);

    const expenses = balances
      .filter((b) => b.type === "EXPENSE")
      .reduce((sum, b) => add(sum, sub(b.debit, b.credit)), ZERO);

    const revenueRows = balances
      .filter((b) => b.type === "REVENUE")
      .map((b) => ({
        code: b.code,
        name: b.name,
        amount: Number(sub(b.credit, b.debit)),
      }))
      .filter((r) => r.amount !== 0);

    const expenseRows = balances
      .filter((b) => b.type === "EXPENSE")
      .map((b) => ({
        code: b.code,
        name: b.name,
        amount: Number(sub(b.debit, b.credit)),
      }))
      .filter((r) => r.amount !== 0);

    const netIncome = sub(revenue, expenses);

    return {
      revenueRows,
      expenseRows,
      totalRevenue: Number(revenue),
      totalExpenses: Number(expenses),
      netIncome: Number(netIncome),
    };
  }

  static async getCashFlow(
    organizationId: string,
    from: Date,
    to: Date,
    branchId?: string | { in: string[] },
  ) {
    const mapping = await this.getAccountMapping(organizationId);
    const cashAccounts = await prisma.account.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { code: mapping.cash },
          { code: mapping.bank },
          { subtype: "CASH" },
          { subtype: "BANK" },
          { subtype: "PETTY_CASH" },
        ],
      },
    });

    const accountIds = cashAccounts.map((a) => a.id);
    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: { in: accountIds },
        journalEntry: {
          organizationId,
          status: "COMPLETED",
          deletedAt: null,
          ...(branchId ? { branchId } : {}),
          entryDate: { gte: from, lte: to },
        },
      },
      include: {
        account: true,
        journalEntry: { select: { referenceType: true, description: true } },
      },
    });

    let operating = ZERO;
    let investing = ZERO;
    let financing = ZERO;

    for (const line of lines) {
      const inflow = sub(line.debit, line.credit);
      const ref = line.journalEntry.referenceType ?? "";
      if (ref === "Sale" || ref === "Expense" || ref === "SupplierPayment" || ref === "Income") {
        operating = add(operating, inflow);
      } else if (ref === "ManualJournal") {
        operating = add(operating, inflow);
      } else {
        financing = add(financing, inflow);
      }
    }

    const netChange = add(operating, add(investing, financing));

    return {
      operating: Number(operating),
      investing: Number(investing),
      financing: Number(financing),
      netChange: Number(netChange),
    };
  }
}

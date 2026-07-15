import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

type Tx = Prisma.TransactionClient;

export class CustomerLedgerService {
  static async getBalance(customerId: string, tx?: Tx) {
    const client = tx ?? prisma;
    const last = await client.customerLedger.findFirst({
      where: { customerId },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    });
    return last?.balance ?? new Decimal(0);
  }

  static async addEntry(
    params: {
      customerId: string;
      entryDate: Date;
      description: string;
      debit: number;
      credit: number;
      referenceType?: string;
      referenceId?: string;
    },
    tx?: Tx,
  ) {
    const client = tx ?? prisma;
    const currentBalance = await this.getBalance(params.customerId, tx);
    const debit = new Decimal(params.debit);
    const credit = new Decimal(params.credit);
    const balance = currentBalance.add(debit).sub(credit);

    return client.customerLedger.create({
      data: {
        customerId: params.customerId,
        entryDate: params.entryDate,
        description: params.description,
        debit,
        credit,
        balance,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      },
    });
  }

  static async postCreditSale(
    params: {
      customerId: string;
      saleId: string;
      saleDate: Date;
      amount: number;
      invoiceNumber: string;
    },
    tx?: Tx,
  ) {
    if (params.amount <= 0) return;
    await this.addEntry(
      {
        customerId: params.customerId,
        entryDate: params.saleDate,
        description: `Credit sale ${params.invoiceNumber}`,
        debit: params.amount,
        credit: 0,
        referenceType: "Sale",
        referenceId: params.saleId,
      },
      tx,
    );
  }

  static async postCreditRefund(
    params: {
      customerId: string;
      saleId: string;
      saleDate: Date;
      amount: number;
      invoiceNumber: string;
    },
    tx?: Tx,
  ) {
    if (params.amount <= 0) return;
    await this.addEntry(
      {
        customerId: params.customerId,
        entryDate: params.saleDate,
        description: `Credit refund ${params.invoiceNumber}`,
        debit: 0,
        credit: params.amount,
        referenceType: "SaleReturn",
        referenceId: params.saleId,
      },
      tx,
    );
  }
}

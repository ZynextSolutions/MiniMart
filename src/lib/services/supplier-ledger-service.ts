import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

type Tx = Prisma.TransactionClient;

export class SupplierLedgerService {
  static async getBalance(supplierId: string, tx?: Tx) {
    const client = tx ?? prisma;
    const last = await client.supplierLedger.findFirst({
      where: { supplierId },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    });
    return last?.balance ?? new Decimal(0);
  }

  static async addEntry(
    params: {
      supplierId: string;
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
    const currentBalance = await this.getBalance(params.supplierId, tx);
    const debit = new Decimal(params.debit);
    const credit = new Decimal(params.credit);
    const balance = currentBalance.add(debit).sub(credit);

    return client.supplierLedger.create({
      data: {
        supplierId: params.supplierId,
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

  static async getStatement(
    supplierId: string,
    organizationId: string,
    from?: Date,
    to?: Date,
  ) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, organizationId },
    });
    if (!supplier) return null;

    const entries = await prisma.supplierLedger.findMany({
      where: {
        supplierId,
        ...(from || to
          ? {
              entryDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    });

    const balance = entries.length > 0 ? entries[entries.length - 1].balance : new Decimal(0);

    return { supplier, entries, balance };
  }

  static async getOutstandingPayables(organizationId: string) {
    const invoices = await prisma.supplierInvoice.findMany({
      where: {
        organizationId,
        status: { in: ["PENDING", "APPROVED", "COMPLETED"] },
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    return invoices
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        supplier: inv.supplier,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        outstanding: inv.totalAmount.sub(inv.paidAmount),
        status: inv.status,
      }))
      .filter((inv) => inv.outstanding.gt(0));
  }
}

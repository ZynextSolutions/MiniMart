import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import type { CashRegisterStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class CashRegisterService {
  static async listRegisters(branchId: string) {
    return prisma.cashRegister.findMany({
      where: { branchId, isActive: true },
      orderBy: { code: "asc" },
      include: {
        sessions: {
          where: { status: "OPEN" },
          take: 1,
          orderBy: { openedAt: "desc" },
        },
      },
    });
  }

  static async getOpenSession(cashRegisterId: string) {
    return prisma.cashRegisterSession.findFirst({
      where: { cashRegisterId, status: "OPEN" },
      include: { cashRegister: true },
    });
  }

  static async openSession(
    cashRegisterId: string,
    openingBalance: number,
    userId: string,
    organizationId: string,
  ) {
    const register = await prisma.cashRegister.findFirst({
      where: { id: cashRegisterId, isActive: true },
      include: { branch: true },
    });
    if (!register) throw new NotFoundError("Cash register");
    if (register.branch.organizationId !== organizationId) {
      throw new NotFoundError("Cash register");
    }

    const existing = await this.getOpenSession(cashRegisterId);
    if (existing) throw new ConflictError("Register already has an open session");

    const session = await prisma.cashRegisterSession.create({
      data: {
        cashRegisterId,
        openedById: userId,
        status: "OPEN",
        openingBalance: new Decimal(openingBalance),
        openedAt: new Date(),
      },
    });

    await AuditService.log({
      organizationId,
      userId,
      action: "cash-register.opened",
      entityType: "CashRegisterSession",
      entityId: session.id,
      after: { openingBalance },
    });

    return session;
  }

  static async closeSession(
    sessionId: string,
    closingBalance: number,
    userId: string,
    organizationId: string,
  ) {
    const session = await prisma.cashRegisterSession.findFirst({
      where: { id: sessionId, status: "OPEN" },
      include: {
        cashRegister: { include: { branch: true } },
        sales: {
          where: { status: "COMPLETED", deletedAt: null },
          include: { payments: true },
        },
      },
    });

    if (!session || session.cashRegister.branch.organizationId !== organizationId) {
      throw new NotFoundError("Cash register session");
    }

    let cashSales = new Decimal(0);
    for (const sale of session.sales) {
      const direction = sale.saleType === "RETURN" ? -1 : 1;
      for (const payment of sale.payments) {
        if (payment.method === "CASH") {
          cashSales =
            direction === 1 ? cashSales.add(payment.amount) : cashSales.sub(payment.amount);
        }
      }
    }

    const expectedCash = session.openingBalance.add(cashSales);
    const closing = new Decimal(closingBalance);
    const variance = closing.sub(expectedCash);

    const updated = await prisma.cashRegisterSession.update({
      where: { id: sessionId },
      data: {
        status: "CLOSED" as CashRegisterStatus,
        closedById: userId,
        closingBalance: closing,
        expectedCash,
        variance,
        closedAt: new Date(),
      },
    });

    await AuditService.log({
      organizationId,
      userId,
      action: "cash-register.closed",
      entityType: "CashRegisterSession",
      entityId: sessionId,
      after: { closingBalance, variance: variance.toString() },
    });

    return updated;
  }

  static async getSessionSummary(sessionId: string, organizationId: string) {
    const session = await prisma.cashRegisterSession.findFirst({
      where: { id: sessionId },
      include: {
        cashRegister: { include: { branch: true } },
        sales: {
          where: { deletedAt: null, status: "COMPLETED" },
          include: { payments: true },
        },
      },
    });

    if (!session || session.cashRegister.branch.organizationId !== organizationId) {
      throw new NotFoundError("Cash register session");
    }

    let totalSales = new Decimal(0);
    let returnTotal = new Decimal(0);
    let cashTotal = new Decimal(0);
    let cashRefundTotal = new Decimal(0);
    let cardTotal = new Decimal(0);
    const paymentBreakdown: Record<string, number> = {};

    for (const sale of session.sales) {
      if (sale.saleType === "RETURN") {
        returnTotal = returnTotal.add(sale.grandTotal);
      } else {
        totalSales = totalSales.add(sale.grandTotal);
      }
      for (const p of sale.payments) {
        const amt = Number(p.amount);
        const signedAmt = sale.saleType === "RETURN" ? -amt : amt;
        paymentBreakdown[p.method] = (paymentBreakdown[p.method] ?? 0) + signedAmt;
        if (p.method === "CASH") {
          if (sale.saleType === "RETURN") {
            cashRefundTotal = cashRefundTotal.add(p.amount);
          } else {
            cashTotal = cashTotal.add(p.amount);
          }
        }
        if (p.method === "CARD") cardTotal = cardTotal.add(p.amount);
      }
    }

    const netSales = totalSales.sub(returnTotal);
    const netCash = cashTotal.sub(cashRefundTotal);

    return {
      transactionCount: session.sales.length,
      totalSales: Number(totalSales),
      returnTotal: Number(returnTotal),
      netSales: Number(netSales),
      cashTotal: Number(cashTotal),
      cashRefundTotal: Number(cashRefundTotal),
      netCash: Number(netCash),
      cardTotal: Number(cardTotal),
      paymentBreakdown,
      expectedCash: Number(session.openingBalance.add(netCash)),
      openingBalance: Number(session.openingBalance),
    };
  }
}

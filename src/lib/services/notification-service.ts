import { prisma } from "@/infrastructure/database/prisma";
import {
  CASH_DRAWER_MAX_OPEN_HOURS,
  LARGE_DISCOUNT_PERCENT,
  SUSPICIOUS_DISCOUNT_PERCENT,
  SUSPICIOUS_RETURN_RATIO,
} from "@/lib/constants/notifications";
import type { NotificationType, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export class NotificationService {
  static async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Prisma.InputJsonValue,
  ) {
    return prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ?? undefined,
      },
    });
  }

  private static async getUsersWithPermission(
    organizationId: string,
    permissionCode: string,
    options?: { excludeUserId?: string; limit?: number },
  ) {
    return prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
        ...(options?.excludeUserId ? { NOT: { id: options.excludeUserId } } : {}),
        userBranchRoles: {
          some: {
            role: {
              rolePermissions: {
                some: { permission: { code: permissionCode } },
              },
            },
          },
        },
      },
      select: { id: true },
      take: options?.limit ?? 20,
    });
  }

  private static async notifyMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    data?: Prisma.InputJsonValue,
  ) {
    if (userIds.length === 0) return;
    await Promise.all(
      userIds.map((userId) => this.create(userId, type, title, message, data)),
    );
  }

  private static async createIfNotExists(params: {
    userId: string;
    type: NotificationType;
    dedupeKey: string;
    since: Date;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }) {
    const recent = await prisma.notification.findMany({
      where: {
        userId: params.userId,
        type: params.type,
        createdAt: { gte: params.since },
      },
      select: { id: true, data: true },
      take: 20,
    });

    const existing = recent.find((n) => {
      const data = n.data as Record<string, unknown> | null;
      return data?.dedupeKey === params.dedupeKey;
    });
    if (existing) return existing;

    return this.create(params.userId, params.type, params.title, params.message, {
      ...params.data,
      dedupeKey: params.dedupeKey,
    });
  }

  static async notifyLowStock(params: {
    organizationId: string;
    variantId: string;
    productName: string;
    warehouseName: string;
    quantity: Decimal;
    reorderLevel: Decimal;
    excludeUserId?: string;
  }) {
    const users = await this.getUsersWithPermission(params.organizationId, "inventory.view", {
      excludeUserId: params.excludeUserId,
    });

    const title = "Low Stock Alert";
    const message = `${params.productName} in ${params.warehouseName} is low: ${params.quantity} (reorder at ${params.reorderLevel})`;

    await this.notifyMany(
      users.map((u) => u.id),
      "LOW_STOCK",
      title,
      message,
      {
        variantId: params.variantId,
        warehouseName: params.warehouseName,
        quantity: params.quantity.toString(),
        reorderLevel: params.reorderLevel.toString(),
        href: "/inventory",
      },
    );
  }

  static async notifyExpiryWarning(params: {
    organizationId: string;
    variantId: string;
    productName: string;
    batchNumber: string;
    expiryDate: Date;
    remainingQty: Decimal;
  }) {
    const users = await this.getUsersWithPermission(params.organizationId, "inventory.view");

    const title = "Expiring Product";
    const message = `Batch ${params.batchNumber} of ${params.productName} expires on ${params.expiryDate.toISOString().slice(0, 10)} (qty: ${params.remainingQty})`;

    await this.notifyMany(
      users.map((u) => u.id),
      "EXPIRY_WARNING",
      title,
      message,
      {
        variantId: params.variantId,
        batchNumber: params.batchNumber,
        expiryDate: params.expiryDate.toISOString(),
        href: "/inventory",
      },
    );
  }

  static async notifyNewPurchaseArrival(params: {
    organizationId: string;
    receiptId: string;
    receiptNumber: string;
    lineCount: number;
    warehouseName: string;
    excludeUserId?: string;
  }) {
    const users = await this.getUsersWithPermission(params.organizationId, "purchasing.receive", {
      excludeUserId: params.excludeUserId,
    });

    const title = "New Purchase Arrival";
    const message = `${params.receiptNumber} received at ${params.warehouseName} (${params.lineCount} line${params.lineCount === 1 ? "" : "s"})`;

    await this.notifyMany(
      users.map((u) => u.id),
      "NEW_PURCHASE_ARRIVAL",
      title,
      message,
      {
        receiptId: params.receiptId,
        receiptNumber: params.receiptNumber,
        href: "/purchasing/receiving",
      },
    );
  }

  static async notifyLargeDiscount(params: {
    organizationId: string;
    saleId: string;
    invoiceNumber: string;
    discountAmount: number;
    subtotal: number;
    discountPercent: number;
    cashierId: string;
  }) {
    const users = await this.getUsersWithPermission(params.organizationId, "pos.access", {
      excludeUserId: params.cashierId,
      limit: 15,
    });

    const title = "Large Discount Applied";
    const message = `Sale ${params.invoiceNumber} has a ${params.discountPercent.toFixed(1)}% discount (${params.discountAmount.toFixed(2)} off ${params.subtotal.toFixed(2)})`;

    await this.notifyMany(
      users.map((u) => u.id),
      "LARGE_DISCOUNT",
      title,
      message,
      {
        saleId: params.saleId,
        invoiceNumber: params.invoiceNumber,
        href: `/reports/sales`,
      },
    );
  }

  static async notifySuspiciousTransaction(params: {
    organizationId: string;
    saleId: string;
    invoiceNumber: string;
    reason: string;
    amount: number;
    cashierId: string;
  }) {
    const users = await this.getUsersWithPermission(params.organizationId, "pos.access", {
      excludeUserId: params.cashierId,
      limit: 15,
    });

    const title = "Suspicious Transaction";
    const message = `${params.reason} — ${params.invoiceNumber} (${params.amount.toFixed(2)})`;

    await this.notifyMany(
      users.map((u) => u.id),
      "SUSPICIOUS_TRANSACTION",
      title,
      message,
      {
        saleId: params.saleId,
        invoiceNumber: params.invoiceNumber,
        href: `/reports/sales`,
      },
    );
  }

  static async checkSaleAlerts(params: {
    organizationId: string;
    saleId: string;
    invoiceNumber: string;
    subtotal: number;
    discountAmount: number;
    grandTotal: number;
    cashierId: string;
  }) {
    const { subtotal, discountAmount } = params;
    if (subtotal <= 0) return;

    const discountPercent = (discountAmount / subtotal) * 100;

    if (discountPercent >= LARGE_DISCOUNT_PERCENT) {
      await this.notifyLargeDiscount({
        organizationId: params.organizationId,
        saleId: params.saleId,
        invoiceNumber: params.invoiceNumber,
        discountAmount,
        subtotal,
        discountPercent,
        cashierId: params.cashierId,
      });
    }

    if (discountPercent >= SUSPICIOUS_DISCOUNT_PERCENT) {
      await this.notifySuspiciousTransaction({
        organizationId: params.organizationId,
        saleId: params.saleId,
        invoiceNumber: params.invoiceNumber,
        reason: `Discount exceeds ${SUSPICIOUS_DISCOUNT_PERCENT}% of subtotal`,
        amount: params.grandTotal,
        cashierId: params.cashierId,
      });
    }
  }

  static async checkReturnAlert(params: {
    organizationId: string;
    saleId: string;
    invoiceNumber: string;
    refundAmount: number;
    originalSaleTotal: number;
    cashierId: string;
  }) {
    if (params.originalSaleTotal <= 0) return;
    const ratio = params.refundAmount / params.originalSaleTotal;
    if (ratio < SUSPICIOUS_RETURN_RATIO) return;

    await this.notifySuspiciousTransaction({
      organizationId: params.organizationId,
      saleId: params.saleId,
      invoiceNumber: params.invoiceNumber,
      reason: `Return refund is ${Math.round(ratio * 100)}% of original sale`,
      amount: params.refundAmount,
      cashierId: params.cashierId,
    });
  }

  static async runScheduledChecks(params: {
    organizationId: string;
    branchId?: string;
    userId: string;
  }) {
    await Promise.all([
      this.checkDailySalesSummary(params),
      this.checkCashDrawerNotClosed(params),
    ]);
  }

  private static async checkDailySalesSummary(params: {
    organizationId: string;
    branchId?: string;
    userId: string;
  }) {
    const canViewReports = await prisma.userBranchRole.findFirst({
      where: {
        userId: params.userId,
        role: {
          rolePermissions: {
            some: { permission: { code: "reports.dashboard" } },
          },
        },
      },
    });
    if (!canViewReports) return;

    const from = startOfToday();
    const to = endOfToday();
    const dedupeKey = `daily-sales-${todayKey()}`;

    const sales = await prisma.sale.findMany({
      where: {
        organizationId: params.organizationId,
        deletedAt: null,
        status: "COMPLETED",
        saleType: "SALE",
        ...(params.branchId ? { branchId: params.branchId } : {}),
        saleDate: { gte: from, lte: to },
      },
      select: { grandTotal: true },
    });

    const totalSales = sales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
    const transactionCount = sales.length;

    await this.createIfNotExists({
      userId: params.userId,
      type: "DAILY_SALES_SUMMARY",
      dedupeKey,
      since: from,
      title: "Daily Sales Summary",
      message: `Today: ${transactionCount} sale${transactionCount === 1 ? "" : "s"}, total ${totalSales.toFixed(2)}`,
      data: {
        totalSales,
        transactionCount,
        date: todayKey(),
        href: "/reports/sales",
      },
    });
  }

  private static async checkCashDrawerNotClosed(params: {
    organizationId: string;
    branchId?: string;
    userId: string;
  }) {
    const canClose = await prisma.userBranchRole.findFirst({
      where: {
        userId: params.userId,
        role: {
          rolePermissions: {
            some: { permission: { code: "cash-register.close" } },
          },
        },
      },
    });
    if (!canClose) return;

    const staleBefore = new Date(Date.now() - CASH_DRAWER_MAX_OPEN_HOURS * 60 * 60 * 1000);

    const openSessions = await prisma.cashRegisterSession.findMany({
      where: {
        status: "OPEN",
        openedAt: { lt: staleBefore },
        cashRegister: {
          branch: {
            organizationId: params.organizationId,
            ...(params.branchId ? { id: params.branchId } : {}),
          },
        },
      },
      include: {
        cashRegister: { select: { name: true, code: true } },
      },
    });

    for (const session of openSessions) {
      const dedupeKey = `cash-drawer-${session.id}-${todayKey()}`;
      await this.createIfNotExists({
        userId: params.userId,
        type: "CASH_DRAWER_NOT_CLOSED",
        dedupeKey,
        since: startOfToday(),
        title: "Cash Drawer Not Closed",
        message: `${session.cashRegister.code} — ${session.cashRegister.name} has been open since ${session.openedAt.toLocaleString()}`,
        data: {
          sessionId: session.id,
          registerCode: session.cashRegister.code,
          href: "/cash-register",
        },
      });
    }
  }

  static async listForUser(
    userId: string,
    params?: { unreadOnly?: boolean; limit?: number; type?: NotificationType },
  ) {
    const { unreadOnly = false, limit = 50, type } = params ?? {};
    return prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  static async markAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  static getDeepLink(type: NotificationType, data: unknown): string | null {
    const d = data as Record<string, string> | null;
    if (d?.href) return d.href;

    switch (type) {
      case "LOW_STOCK":
      case "EXPIRY_WARNING":
        return "/inventory";
      case "NEW_PURCHASE_ARRIVAL":
        return "/purchasing/receiving";
      case "DAILY_SALES_SUMMARY":
      case "LARGE_DISCOUNT":
      case "SUSPICIOUS_TRANSACTION":
        return "/reports/sales";
      case "CASH_DRAWER_NOT_CLOSED":
        return "/cash-register";
      case "PAYMENT_DUE":
        return "/purchasing/payables";
      case "APPROVAL_REQUIRED":
        return d?.href ?? "/purchasing/requests";
      default:
        return null;
    }
  }
}

import { prisma } from "@/infrastructure/database/prisma";
import { ReportService } from "@/features/reports/services/report.service";
import type { BranchFilter } from "@/lib/auth/branch-access";
import {
  dateKeyAddDays,
  DEFAULT_ORG_TIMEZONE,
  endOfOrgDay,
  formatDateKeyLabel,
  orgLocalDateKey,
  resolveOrgTimezone,
  startOfOrgDay,
  startOfOrgDayForDateKey,
} from "@/lib/utils/datetime";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface DashboardFilters {
  organizationId: string;
  branchId?: BranchFilter;
  timezone?: string;
}

function branchWhere(branchId?: BranchFilter): { branchId?: BranchFilter } {
  if (!branchId) return {};
  return { branchId };
}

function toNum(v: Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

function saleWhere(filters: DashboardFilters, from: Date, to: Date): Prisma.SaleWhereInput {
  return {
    organizationId: filters.organizationId,
    deletedAt: null,
    status: "COMPLETED",
    saleType: "SALE",
    ...branchWhere(filters.branchId),
    saleDate: { gte: from, lte: to },
  };
}

function returnWhere(filters: DashboardFilters, from: Date, to: Date): Prisma.SaleWhereInput {
  return {
    organizationId: filters.organizationId,
    deletedAt: null,
    status: "COMPLETED",
    saleType: "RETURN",
    ...branchWhere(filters.branchId),
    saleDate: { gte: from, lte: to },
  };
}

function warehouseWhere(filters: DashboardFilters): Prisma.WarehouseWhereInput {
  return {
    organizationId: filters.organizationId,
    deletedAt: null,
    ...branchWhere(filters.branchId),
  };
}

async function branchWarehouseIds(filters: DashboardFilters): Promise<string[] | undefined> {
  if (!filters.branchId) return undefined;
  const warehouses = await prisma.warehouse.findMany({
    where: warehouseWhere(filters),
    select: { id: true },
  });
  return warehouses.map((w) => w.id);
}

type LowStockRow = {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  warehouseName: string;
  quantity: number;
  reorderLevel: number;
};

export class DashboardService {
  private static orgTimezone(filters: DashboardFilters): string {
    return resolveOrgTimezone(filters.timezone ?? DEFAULT_ORG_TIMEZONE);
  }

  private static async loadLowStockRows(filters: DashboardFilters): Promise<LowStockRow[]> {
    const levels = await prisma.stockLevel.findMany({
      where: {
        warehouse: warehouseWhere(filters),
      },
      include: {
        warehouse: { select: { name: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
            product: { select: { name: true, reorderLevel: true } },
          },
        },
      },
    });

    return levels
      .filter(
        (level) =>
          level.quantity.lte(level.variant.product.reorderLevel) &&
          level.variant.product.reorderLevel.gt(0),
      )
      .map((level) => ({
        variantId: level.variant.id,
        productName: level.variant.product.name,
        variantName: level.variant.name,
        sku: level.variant.sku,
        warehouseName: level.warehouse.name,
        quantity: toNum(level.quantity),
        reorderLevel: toNum(level.variant.product.reorderLevel),
      }))
      .sort((a, b) => a.quantity / a.reorderLevel - b.quantity / b.reorderLevel);
  }

  static async getKPIs(filters: DashboardFilters) {
    const timezone = this.orgTimezone(filters);
    const now = new Date();
    const todayStart = startOfOrgDay(now, timezone);
    const todayEnd = endOfOrgDay(now, timezone);

    const [todaySales, todayReturns, lowStockRows, expiringSoonCount, productCount, customerCount, openSessions] =
      await Promise.all([
        prisma.sale.findMany({
          where: saleWhere(filters, todayStart, todayEnd),
          select: { grandTotal: true },
        }),
        prisma.sale.findMany({
          where: returnWhere(filters, todayStart, todayEnd),
          select: { grandTotal: true },
        }),
        this.loadLowStockRows(filters),
        this.countExpiringSoon(filters),
        prisma.product.count({
          where: {
            organizationId: filters.organizationId,
            deletedAt: null,
            isActive: true,
          },
        }),
        prisma.customer.count({
          where: {
            organizationId: filters.organizationId,
            deletedAt: null,
            isActive: true,
          },
        }),
        prisma.cashRegisterSession.findMany({
          where: {
            status: "OPEN",
            cashRegister: {
              branch: { organizationId: filters.organizationId },
              ...branchWhere(filters.branchId),
            },
          },
          select: { expectedCash: true, openingBalance: true },
        }),
      ]);

    const todaySalesTotal = todaySales.reduce((sum, s) => sum + toNum(s.grandTotal), 0);
    const todayReturnsTotal = todayReturns.reduce((sum, s) => sum + toNum(s.grandTotal), 0);
    const todayNetSales = todaySalesTotal - todayReturnsTotal;
    const todayTransactionCount = todaySales.length;
    const todayReturnCount = todayReturns.length;
    const avgTransaction =
      todayTransactionCount > 0 ? todayNetSales / todayTransactionCount : 0;

    const cashInRegister = openSessions.reduce(
      (sum, s) => sum + toNum(s.expectedCash ?? s.openingBalance),
      0,
    );

    return {
      todaySales: todaySalesTotal,
      todayReturns: todayReturnsTotal,
      todayNetSales,
      todayTransactionCount,
      todayReturnCount,
      avgTransaction,
      lowStockCount: lowStockRows.length,
      expiringSoonCount,
      productCount,
      customerCount,
      cashInRegister,
      openRegisterCount: openSessions.length,
    };
  }

  static async getSalesTrend(filters: DashboardFilters, days = 30) {
    const timezone = this.orgTimezone(filters);
    const now = new Date();
    const to = endOfOrgDay(now, timezone);
    const endKey = orgLocalDateKey(now, timezone);
    const startKey = dateKeyAddDays(endKey, -(days - 1));
    const from = startOfOrgDayForDateKey(startKey, timezone);

    const report = await ReportService.getDailySales({
      organizationId: filters.organizationId,
      branchId: filters.branchId,
      from,
      to,
      timezone,
    });

    const byDate = new Map(report.rows.map((r) => [r.date, r.netSales]));
    const rows: { date: string; label: string; sales: number }[] = [];

    for (let i = 0; i < days; i++) {
      const date = dateKeyAddDays(startKey, i);
      rows.push({
        date,
        label: formatDateKeyLabel(date),
        sales: byDate.get(date) ?? 0,
      });
    }

    return rows;
  }

  static async getTopProducts(filters: DashboardFilters, days = 7, limit = 10) {
    const timezone = this.orgTimezone(filters);
    const now = new Date();
    const to = endOfOrgDay(now, timezone);
    const fromKey = dateKeyAddDays(orgLocalDateKey(now, timezone), -(days - 1));
    const from = startOfOrgDayForDateKey(fromKey, timezone);

    const report = await ReportService.getBestSelling(
      {
        organizationId: filters.organizationId,
        branchId: filters.branchId,
        from,
        to,
        timezone,
      },
      limit,
    );

    return report.rows.map((r) => ({
      name: r.productName.length > 24 ? `${r.productName.slice(0, 22)}…` : r.productName,
      fullName: r.productName,
      sku: r.sku,
      revenue: r.revenue,
      quantity: r.quantity,
    }));
  }

  static async getPaymentBreakdown(filters: DashboardFilters, days = 7) {
    const timezone = this.orgTimezone(filters);
    const now = new Date();
    const to = endOfOrgDay(now, timezone);
    const fromKey = dateKeyAddDays(orgLocalDateKey(now, timezone), -(days - 1));
    const from = startOfOrgDayForDateKey(fromKey, timezone);

    const report = await ReportService.getSalesByPaymentMethod({
      organizationId: filters.organizationId,
      branchId: filters.branchId,
      from,
      to,
      timezone,
    });

    return report.rows.map((r) => ({
      method: r.method,
      label: formatPaymentMethod(r.method),
      amount: r.netAmount,
      count: r.transactionCount,
    }));
  }

  static async getRecentTransactions(filters: DashboardFilters, limit = 10) {
    const sales = await prisma.sale.findMany({
      where: {
        organizationId: filters.organizationId,
        deletedAt: null,
        status: "COMPLETED",
        saleType: "SALE",
        ...branchWhere(filters.branchId),
      },
      orderBy: { saleDate: "desc" },
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        grandTotal: true,
        customer: { select: { name: true } },
        cashier: { select: { firstName: true, lastName: true, email: true } },
        payments: { select: { method: true, amount: true } },
      },
    });

    return sales.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      saleDate: s.saleDate.toISOString(),
      grandTotal: toNum(s.grandTotal),
      customerName: s.customer?.name ?? "Walk-in",
      cashierName:
        [s.cashier.firstName, s.cashier.lastName].filter(Boolean).join(" ") ||
        s.cashier.email,
      paymentMethods: [...new Set(s.payments.map((p) => formatPaymentMethod(p.method)))],
    }));
  }

  static async getLowStockAlerts(filters: DashboardFilters, limit = 8) {
    const rows = await this.loadLowStockRows(filters);
    return rows.slice(0, limit);
  }

  static async getExpiryWarnings(filters: DashboardFilters, limit = 8) {
    const timezone = this.orgTimezone(filters);
    const now = startOfOrgDay(new Date(), timezone);
    const warningDate = endOfOrgDay(
      new Date(startOfOrgDayForDateKey(dateKeyAddDays(orgLocalDateKey(new Date(), timezone), 30), timezone)),
      timezone,
    );
    const warehouseIds = await branchWarehouseIds(filters);

    const batches = await prisma.productBatch.findMany({
      where: {
        remainingQty: { gt: 0 },
        expiryDate: { not: null, gte: now, lte: warningDate },
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        variant: {
          product: {
            organizationId: filters.organizationId,
            deletedAt: null,
          },
        },
      },
      orderBy: { expiryDate: "asc" },
      take: limit,
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    return batches.map((b) => mapExpiryBatch(b, now));
  }

  private static async countExpiringSoon(filters: DashboardFilters): Promise<number> {
    const timezone = this.orgTimezone(filters);
    const now = startOfOrgDay(new Date(), timezone);
    const warningDate = endOfOrgDay(
      new Date(startOfOrgDayForDateKey(dateKeyAddDays(orgLocalDateKey(new Date(), timezone), 30), timezone)),
      timezone,
    );
    const warehouseIds = await branchWarehouseIds(filters);

    return prisma.productBatch.count({
      where: {
        remainingQty: { gt: 0 },
        expiryDate: { not: null, gte: now, lte: warningDate },
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        variant: {
          product: {
            organizationId: filters.organizationId,
            deletedAt: null,
          },
        },
      },
    });
  }
}

function mapExpiryBatch(
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: Date | null;
    remainingQty: Decimal;
    variant: { id: string; sku: string; product: { name: string } };
  },
  now: Date,
) {
  return {
    batchId: batch.id,
    variantId: batch.variant.id,
    productName: batch.variant.product.name,
    sku: batch.variant.sku,
    batchNumber: batch.batchNumber,
    expiryDate: batch.expiryDate!.toISOString().slice(0, 10),
    remainingQty: toNum(batch.remainingQty),
    daysUntilExpiry: Math.ceil(
      (batch.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    ),
  };
}

function formatPaymentMethod(method: string): string {
  const labels: Record<string, string> = {
    CASH: "Cash",
    CARD: "Card",
    QR: "QR",
    BANK_TRANSFER: "Bank Transfer",
    GIFT_CARD: "Gift Card",
    LOYALTY_POINTS: "Loyalty Points",
    MIXED: "Mixed",
    CREDIT: "Credit",
  };
  return labels[method] ?? method;
}

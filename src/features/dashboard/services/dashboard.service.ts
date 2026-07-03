import { prisma } from "@/infrastructure/database/prisma";
import { ReportService } from "@/features/reports/services/report.service";
import { InventoryQueryService } from "@/features/inventory/services/inventory-query.service";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface DashboardFilters {
  organizationId: string;
  branchId?: string;
}

function toNum(v: Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function saleWhere(filters: DashboardFilters, from: Date, to: Date): Prisma.SaleWhereInput {
  return {
    organizationId: filters.organizationId,
    deletedAt: null,
    status: "COMPLETED",
    saleType: "SALE",
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    saleDate: { gte: from, lte: to },
  };
}

function returnWhere(filters: DashboardFilters, from: Date, to: Date): Prisma.SaleWhereInput {
  return {
    organizationId: filters.organizationId,
    deletedAt: null,
    status: "COMPLETED",
    saleType: "RETURN",
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    saleDate: { gte: from, lte: to },
  };
}

function warehouseWhere(filters: DashboardFilters): Prisma.WarehouseWhereInput {
  return {
    organizationId: filters.organizationId,
    deletedAt: null,
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
  };
}

export class DashboardService {
  static async getKPIs(filters: DashboardFilters) {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const [
      todaySales,
      todayReturns,
      inventorySummary,
      expiringSoonCount,
      productCount,
      customerCount,
      openSessions,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhere(filters, today, todayEnd),
        select: { grandTotal: true },
      }),
      prisma.sale.findMany({
        where: returnWhere(filters, today, todayEnd),
        select: { grandTotal: true },
      }),
      InventoryQueryService.getSummary(filters.organizationId),
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
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
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
      lowStockCount: inventorySummary.lowStockCount,
      expiringSoonCount,
      productCount,
      customerCount,
      cashInRegister,
      openRegisterCount: openSessions.length,
    };
  }

  static async getSalesTrend(filters: DashboardFilters, days = 30) {
    const to = endOfDay(new Date());
    const from = startOfDay(new Date());
    from.setDate(from.getDate() - (days - 1));

    const report = await ReportService.getDailySales({
      organizationId: filters.organizationId,
      branchId: filters.branchId,
      from,
      to,
    });

    const byDate = new Map(report.rows.map((r) => [r.date, r.netSales]));
    const rows: { date: string; label: string; sales: number }[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const date = localDateKey(d);
      rows.push({
        date,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        sales: byDate.get(date) ?? 0,
      });
    }

    return rows;
  }

  static async getTopProducts(filters: DashboardFilters, days = 7, limit = 10) {
    const to = endOfDay(new Date());
    const from = startOfDay(new Date());
    from.setDate(from.getDate() - (days - 1));

    const report = await ReportService.getBestSelling(
      {
        organizationId: filters.organizationId,
        branchId: filters.branchId,
        from,
        to,
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
    const to = endOfDay(new Date());
    const from = startOfDay(new Date());
    from.setDate(from.getDate() - (days - 1));

    const report = await ReportService.getSalesByPaymentMethod({
      organizationId: filters.organizationId,
      branchId: filters.branchId,
      from,
      to,
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
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
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
    const levels = await prisma.stockLevel.findMany({
      where: {
        warehouse: warehouseWhere(filters),
        quantity: { gt: 0 },
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
        (l) =>
          l.quantity.lte(l.variant.product.reorderLevel) &&
          l.variant.product.reorderLevel.gt(0),
      )
      .map((l) => ({
        variantId: l.variant.id,
        productName: l.variant.product.name,
        variantName: l.variant.name,
        sku: l.variant.sku,
        warehouseName: l.warehouse.name,
        quantity: toNum(l.quantity),
        reorderLevel: toNum(l.variant.product.reorderLevel),
      }))
      .sort((a, b) => a.quantity / a.reorderLevel - b.quantity / b.reorderLevel)
      .slice(0, limit);
  }

  static async getExpiryWarnings(filters: DashboardFilters, limit = 8) {
    const now = startOfDay(new Date());
    const warningDate = new Date(now);
    warningDate.setDate(warningDate.getDate() + 30);

    const batches = await prisma.productBatch.findMany({
      where: {
        remainingQty: { gt: 0 },
        expiryDate: { not: null, gte: now, lte: warningDate },
        variant: {
          product: {
            organizationId: filters.organizationId,
            deletedAt: null,
          },
        },
      },
      orderBy: { expiryDate: "asc" },
      take: limit * 2,
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

    if (filters.branchId) {
      const branchVariantIds = new Set(
        (
          await prisma.stockLevel.findMany({
            where: { warehouse: warehouseWhere(filters) },
            select: { variantId: true },
          })
        ).map((s) => s.variantId),
      );
      return batches
        .filter((b) => branchVariantIds.has(b.variantId))
        .slice(0, limit)
        .map((b) => ({
          batchId: b.id,
          variantId: b.variant.id,
          productName: b.variant.product.name,
          sku: b.variant.sku,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate!.toISOString().slice(0, 10),
          remainingQty: toNum(b.remainingQty),
          daysUntilExpiry: Math.ceil(
            (b.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          ),
        }));
    }

    return batches.slice(0, limit).map((b) => ({
      batchId: b.id,
      variantId: b.variant.id,
      productName: b.variant.product.name,
      sku: b.variant.sku,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate!.toISOString().slice(0, 10),
      remainingQty: toNum(b.remainingQty),
      daysUntilExpiry: Math.ceil(
        (b.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }

  private static async countExpiringSoon(filters: DashboardFilters): Promise<number> {
    const now = startOfDay(new Date());
    const warningDate = new Date(now);
    warningDate.setDate(warningDate.getDate() + 30);

    const where: Prisma.ProductBatchWhereInput = {
      remainingQty: { gt: 0 },
      expiryDate: { not: null, gte: now, lte: warningDate },
      variant: {
        product: {
          organizationId: filters.organizationId,
          deletedAt: null,
        },
      },
    };

    if (filters.branchId) {
      const branchVariantIds = (
        await prisma.stockLevel.findMany({
          where: { warehouse: warehouseWhere(filters) },
          select: { variantId: true },
        })
      ).map((s) => s.variantId);

      return prisma.productBatch.count({
        where: { ...where, variantId: { in: branchVariantIds } },
      });
    }

    return prisma.productBatch.count({ where });
  }
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

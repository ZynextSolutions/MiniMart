import { prisma } from "@/infrastructure/database/prisma";
import { InventoryQueryService } from "@/features/inventory/services/inventory-query.service";
import type { PaymentMethod, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { BranchFilter } from "@/lib/auth/branch-access";

export interface ReportFilters {
  organizationId: string;
  branchId?: BranchFilter;
  from: Date;
  to: Date;
  page?: number;
  pageSize?: number;
}

function branchWhere(branchId?: BranchFilter): { branchId?: BranchFilter } {
  if (!branchId) return {};
  return { branchId };
}

function saleWhere(filters: ReportFilters): Prisma.SaleWhereInput {
  return {
    organizationId: filters.organizationId,
    deletedAt: null,
    status: "COMPLETED",
    saleType: "SALE",
    ...branchWhere(filters.branchId),
    saleDate: { gte: filters.from, lte: filters.to },
  };
}

function saleWhereByType(
  filters: ReportFilters,
  saleType: "SALE" | "RETURN",
): Prisma.SaleWhereInput {
  return {
    organizationId: filters.organizationId,
    deletedAt: null,
    status: "COMPLETED",
    saleType,
    ...branchWhere(filters.branchId),
    saleDate: { gte: filters.from, lte: filters.to },
  };
}

function toNum(v: Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeRatePercent(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return 0;
  return rate <= 1 ? rate * 100 : rate;
}

export class ReportService {
  // ─── Sales ───────────────────────────────────────────────

  static async getSalesNetSummary(filters: ReportFilters) {
    const [sales, returns] = await Promise.all([
      prisma.sale.aggregate({
        where: saleWhereByType(filters, "SALE"),
        _sum: { grandTotal: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where: saleWhereByType(filters, "RETURN"),
        _sum: { grandTotal: true },
        _count: true,
      }),
    ]);

    const grossSales = toNum(sales._sum.grandTotal);
    const returnsTotal = toNum(returns._sum.grandTotal);

    return {
      grossSales,
      returnsTotal,
      netSales: grossSales - returnsTotal,
      salesCount: sales._count,
      returnCount: returns._count,
      totalTransactionCount: sales._count + returns._count,
    };
  }

  static async getDailySales(filters: ReportFilters) {
    const [sales, returns] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhereByType(filters, "SALE"),
        select: {
          saleDate: true,
          grandTotal: true,
          taxAmount: true,
          discountAmount: true,
        },
      }),
      prisma.sale.findMany({
        where: saleWhereByType(filters, "RETURN"),
        select: {
          saleDate: true,
          grandTotal: true,
          taxAmount: true,
        },
      }),
    ]);

    const byDate = new Map<
      string,
      {
        date: string;
        transactionCount: number;
        returnCount: number;
        totalTransactionCount: number;
        totalSales: number;
        totalReturns: number;
        netSales: number;
        totalTax: number;
        totalDiscount: number;
      }
    >();

    for (const s of sales) {
      const date = localDateKey(s.saleDate);
      const row = byDate.get(date) ?? {
        date,
        transactionCount: 0,
        returnCount: 0,
        totalTransactionCount: 0,
        totalSales: 0,
        totalReturns: 0,
        netSales: 0,
        totalTax: 0,
        totalDiscount: 0,
      };
      row.transactionCount += 1;
      row.totalTransactionCount += 1;
      row.totalSales += toNum(s.grandTotal);
      row.netSales += toNum(s.grandTotal);
      row.totalTax += toNum(s.taxAmount);
      row.totalDiscount += toNum(s.discountAmount);
      byDate.set(date, row);
    }

    for (const r of returns) {
      const date = localDateKey(r.saleDate);
      const row = byDate.get(date) ?? {
        date,
        transactionCount: 0,
        returnCount: 0,
        totalTransactionCount: 0,
        totalSales: 0,
        totalReturns: 0,
        netSales: 0,
        totalTax: 0,
        totalDiscount: 0,
      };
      row.returnCount += 1;
      row.totalTransactionCount += 1;
      row.totalReturns += toNum(r.grandTotal);
      row.netSales -= toNum(r.grandTotal);
      row.totalTax -= toNum(r.taxAmount);
      byDate.set(date, row);
    }

    const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    const totals = rows.reduce(
      (acc, r) => ({
        transactionCount: acc.transactionCount + r.transactionCount,
        returnCount: acc.returnCount + r.returnCount,
        totalTransactionCount: acc.totalTransactionCount + r.totalTransactionCount,
        totalSales: acc.totalSales + r.totalSales,
        totalReturns: acc.totalReturns + r.totalReturns,
        netSales: acc.netSales + r.netSales,
        totalTax: acc.totalTax + r.totalTax,
        totalDiscount: acc.totalDiscount + r.totalDiscount,
      }),
      {
        transactionCount: 0,
        returnCount: 0,
        totalTransactionCount: 0,
        totalSales: 0,
        totalReturns: 0,
        netSales: 0,
        totalTax: 0,
        totalDiscount: 0,
      },
    );

    return { rows, totals };
  }

  static async getSalesByProduct(filters: ReportFilters) {
    const lines = await prisma.saleLine.findMany({
      where: {
        sale: saleWhere(filters),
      },
      select: {
        variantId: true,
        productName: true,
        sku: true,
        quantity: true,
        lineTotal: true,
        costPrice: true,
      },
    });

    const byVariant = new Map<
      string,
      { variantId: string; productName: string; sku: string; quantity: number; revenue: number; cogs: number }
    >();

    for (const l of lines) {
      const row = byVariant.get(l.variantId) ?? {
        variantId: l.variantId,
        productName: l.productName,
        sku: l.sku,
        quantity: 0,
        revenue: 0,
        cogs: 0,
      };
      row.quantity += toNum(l.quantity);
      row.revenue += toNum(l.lineTotal);
      row.cogs += toNum(l.costPrice) * toNum(l.quantity);
      byVariant.set(l.variantId, row);
    }

    const rows = Array.from(byVariant.values())
      .map((r) => ({
        ...r,
        margin: r.revenue - r.cogs,
        marginPct: r.revenue > 0 ? ((r.revenue - r.cogs) / r.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const total = rows.length;

    return {
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getSalesByCategory(filters: ReportFilters) {
    const lines = await prisma.saleLine.findMany({
      where: { sale: saleWhere(filters) },
      select: {
        lineTotal: true,
        quantity: true,
        variant: {
          select: {
            product: {
              select: {
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const byCategory = new Map<string, { categoryId: string; categoryName: string; quantity: number; revenue: number }>();

    for (const l of lines) {
      const cat = l.variant.product.category;
      const key = cat?.id ?? "uncategorized";
      const name = cat?.name ?? "Uncategorized";
      const row = byCategory.get(key) ?? { categoryId: key, categoryName: name, quantity: 0, revenue: 0 };
      row.quantity += toNum(l.quantity);
      row.revenue += toNum(l.lineTotal);
      byCategory.set(key, row);
    }

    return {
      rows: Array.from(byCategory.values()).sort((a, b) => b.revenue - a.revenue),
    };
  }

  static async getSalesByCashier(filters: ReportFilters) {
    const sales = await prisma.sale.findMany({
      where: {
        organizationId: filters.organizationId,
        deletedAt: null,
        status: "COMPLETED",
        saleType: { in: ["SALE", "RETURN"] },
        ...branchWhere(filters.branchId),
        saleDate: { gte: filters.from, lte: filters.to },
      },
      select: {
        saleType: true,
        grandTotal: true,
        cashier: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    const byCashier = new Map<
      string,
      {
        cashierId: string;
        cashierName: string;
        transactionCount: number;
        returnCount: number;
        totalTransactionCount: number;
        totalSales: number;
        totalReturns: number;
        netSales: number;
      }
    >();

    for (const s of sales) {
      const row = byCashier.get(s.cashier.id) ?? {
        cashierId: s.cashier.id,
        cashierName:
          [s.cashier.firstName, s.cashier.lastName].filter(Boolean).join(" ") || s.cashier.email,
        transactionCount: 0,
        returnCount: 0,
        totalTransactionCount: 0,
        totalSales: 0,
        totalReturns: 0,
        netSales: 0,
      };
      if (s.saleType === "RETURN") {
        row.returnCount += 1;
        row.totalTransactionCount += 1;
        row.totalReturns += toNum(s.grandTotal);
        row.netSales -= toNum(s.grandTotal);
      } else {
        row.transactionCount += 1;
        row.totalTransactionCount += 1;
        row.totalSales += toNum(s.grandTotal);
        row.netSales += toNum(s.grandTotal);
      }
      byCashier.set(s.cashier.id, row);
    }

    return { rows: Array.from(byCashier.values()).sort((a, b) => b.netSales - a.netSales) };
  }

  static async getSalesInvoiceList(
    filters: ReportFilters,
    params?: { query?: string; paymentMethod?: string },
  ) {
    const q = params?.query?.trim();
    const paymentMethod = params?.paymentMethod as PaymentMethod | undefined;
    const rows = await prisma.sale.findMany({
      where: {
        ...saleWhereByType(filters, "SALE"),
        ...(paymentMethod ? { payments: { some: { method: paymentMethod } } } : {}),
        ...(q
          ? {
              OR: [
                { invoiceNumber: { contains: q, mode: "insensitive" } },
                { customer: { is: { name: { contains: q, mode: "insensitive" } } } },
                { cashier: { is: { firstName: { contains: q, mode: "insensitive" } } } },
                { cashier: { is: { lastName: { contains: q, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        grandTotal: true,
        taxAmount: true,
        customer: { select: { name: true } },
        cashier: { select: { firstName: true, lastName: true, email: true } },
        payments: { select: { method: true } },
      },
      orderBy: { saleDate: "desc" },
      take: 200,
    });

    return {
      rows: rows.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        saleDate: s.saleDate,
        customerName: s.customer?.name ?? "Walk-in",
        cashierName:
          [s.cashier.firstName, s.cashier.lastName].filter(Boolean).join(" ") || s.cashier.email,
        paymentMethods: [...new Set(s.payments.map((p) => p.method))].join(", "),
        taxAmount: toNum(s.taxAmount),
        grandTotal: toNum(s.grandTotal),
      })),
    };
  }

  static async getReturnList(
    filters: ReportFilters,
    params?: { query?: string; paymentMethod?: string },
  ) {
    const q = params?.query?.trim();
    const paymentMethod = params?.paymentMethod as PaymentMethod | undefined;
    const rows = await prisma.sale.findMany({
      where: {
        ...saleWhereByType(filters, "RETURN"),
        ...(paymentMethod ? { payments: { some: { method: paymentMethod } } } : {}),
        ...(q
          ? {
              OR: [
                { invoiceNumber: { contains: q, mode: "insensitive" } },
                { notes: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        originalSaleId: true,
        originalSale: { select: { invoiceNumber: true } },
        invoiceNumber: true,
        saleDate: true,
        grandTotal: true,
        taxAmount: true,
        cashier: { select: { firstName: true, lastName: true, email: true } },
        payments: { select: { method: true } },
      },
      orderBy: { saleDate: "desc" },
      take: 200,
    });

    return {
      rows: rows.map((s) => ({
        id: s.id,
        returnInvoiceNumber: s.invoiceNumber,
        originalSaleId: s.originalSaleId,
        originalInvoiceNumber: s.originalSale?.invoiceNumber ?? null,
        saleDate: s.saleDate,
        cashierName:
          [s.cashier.firstName, s.cashier.lastName].filter(Boolean).join(" ") || s.cashier.email,
        paymentMethods: [...new Set(s.payments.map((p) => p.method))].join(", "),
        taxAmount: toNum(s.taxAmount),
        refundAmount: toNum(s.grandTotal),
      })),
    };
  }

  static async getSalesByPaymentMethod(filters: ReportFilters) {
    const payments = await prisma.payment.findMany({
      where: {
        sale: {
          organizationId: filters.organizationId,
          deletedAt: null,
          status: "COMPLETED",
          saleType: { in: ["SALE", "RETURN"] },
          ...branchWhere(filters.branchId),
          saleDate: { gte: filters.from, lte: filters.to },
        },
      },
      select: { method: true, amount: true, saleId: true, sale: { select: { saleType: true } } },
    });

    const byMethod = new Map<
      string,
      {
        method: string;
        saleCount: number;
        returnCount: number;
        transactionCount: number;
        grossAmount: number;
        refundAmount: number;
        netAmount: number;
        saleIds: Set<string>;
        returnIds: Set<string>;
      }
    >();

    for (const p of payments) {
      const row = byMethod.get(p.method) ?? {
        method: p.method,
        saleCount: 0,
        returnCount: 0,
        transactionCount: 0,
        grossAmount: 0,
        refundAmount: 0,
        netAmount: 0,
        saleIds: new Set<string>(),
        returnIds: new Set<string>(),
      };
      if (p.sale.saleType === "RETURN") {
        row.returnIds.add(p.saleId);
        row.refundAmount += toNum(p.amount);
        row.returnCount = row.returnIds.size;
      } else {
        row.saleIds.add(p.saleId);
        row.grossAmount += toNum(p.amount);
        row.saleCount = row.saleIds.size;
      }
      row.netAmount = row.grossAmount - row.refundAmount;
      row.transactionCount = row.saleCount + row.returnCount;
      byMethod.set(p.method, row);
    }

    return {
      rows: Array.from(byMethod.values())
        .map(({ saleIds: _, returnIds: __, ...row }) => row)
        .sort((a, b) => b.netAmount - a.netAmount),
    };
  }

  // ─── Purchases ───────────────────────────────────────────

  static async getPurchaseSummary(filters: ReportFilters) {
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId: filters.organizationId,
        ...branchWhere(filters.branchId),
        orderDate: { gte: filters.from, lte: filters.to },
        status: { in: ["COMPLETED", "APPROVED"] },
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
      },
    });

    const bySupplier = new Map<
      string,
      { supplierId: string; supplierName: string; supplierCode: string; orderCount: number; totalAmount: number }
    >();

    for (const o of orders) {
      const row = bySupplier.get(o.supplierId) ?? {
        supplierId: o.supplierId,
        supplierName: o.supplier.name,
        supplierCode: o.supplier.code,
        orderCount: 0,
        totalAmount: 0,
      };
      row.orderCount += 1;
      row.totalAmount += toNum(o.totalAmount);
      bySupplier.set(o.supplierId, row);
    }

    const receipts = await prisma.goodsReceipt.findMany({
      where: {
        organizationId: filters.organizationId,
        ...(filters.branchId
          ? { warehouse: { ...branchWhere(filters.branchId) } }
          : {}),
        receiptDate: { gte: filters.from, lte: filters.to },
        status: "COMPLETED",
      },
      include: {
        lines: { select: { quantity: true, unitCost: true } },
      },
    });

    const grnSummary = {
      receiptCount: receipts.length,
      totalValue: receipts.reduce(
        (sum, r) =>
          sum +
          r.lines.reduce((ls, l) => ls + toNum(l.quantity) * toNum(l.unitCost), 0),
        0,
      ),
    };

    return {
      supplierRows: Array.from(bySupplier.values()).sort((a, b) => b.totalAmount - a.totalAmount),
      grnSummary,
      orderCount: orders.length,
      orderTotal: orders.reduce((s, o) => s + toNum(o.totalAmount), 0),
    };
  }

  // ─── Inventory ───────────────────────────────────────────

  static async getStockOnHand(filters: ReportFilters & { warehouseId?: string; search?: string }) {
    return InventoryQueryService.listStockLevels({
      organizationId: filters.organizationId,
      warehouseId: filters.warehouseId,
      search: filters.search,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 50,
    });
  }

  static async getInventoryValuation(filters: ReportFilters & { warehouseId?: string }) {
    const rows = await InventoryQueryService.getValuation(filters.organizationId, filters.warehouseId);
    const totalValue = rows.reduce((s, r) => s + toNum(r.totalValue), 0);
    return { rows, totalValue };
  }

  static async getInventoryMovement(filters: ReportFilters & { warehouseId?: string }) {
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        organizationId: filters.organizationId,
        status: "COMPLETED",
        movementDate: { gte: filters.from, lte: filters.to },
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
      include: {
        warehouse: { select: { name: true } },
        lines: {
          select: {
            quantity: true,
            totalCost: true,
            variant: { select: { sku: true, product: { select: { name: true } } } },
          },
        },
      },
      orderBy: { movementDate: "desc" },
      take: filters.pageSize ?? 100,
    });

    return {
      rows: movements.map((m) => ({
        id: m.id,
        movementNumber: m.movementNumber,
        movementType: m.movementType,
        movementDate: m.movementDate,
        warehouseName: m.warehouse.name,
        lineCount: m.lines.length,
        totalCost: m.lines.reduce((s, l) => s + toNum(l.totalCost), 0),
      })),
    };
  }

  // ─── Profit Analysis ─────────────────────────────────────

  static async getProfitByProduct(filters: ReportFilters) {
    const result = await this.getSalesByProduct({ ...filters, pageSize: 500 });
    const rows = result.rows.map((r) => ({
      ...r,
      marginPct: Math.round(r.marginPct * 100) / 100,
    }));
    const totals = rows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        cogs: acc.cogs + r.cogs,
        margin: acc.margin + r.margin,
      }),
      { revenue: 0, cogs: 0, margin: 0 },
    );
    return { rows, totals };
  }

  static async getBestSelling(filters: ReportFilters, limit = 20) {
    const { rows } = await this.getSalesByProduct({ ...filters, pageSize: 500 });
    return { rows: rows.slice(0, limit) };
  }

  static async getSlowMoving(filters: ReportFilters, thresholdQty = 5) {
    const { rows: salesRows } = await this.getSalesByProduct({ ...filters, pageSize: 1000 });
    const salesMap = new Map(salesRows.map((r) => [r.variantId, r.quantity]));

    const stock = await prisma.stockLevel.findMany({
      where: {
        warehouse: {
          organizationId: filters.organizationId,
          deletedAt: null,
          ...branchWhere(filters.branchId),
        },
        quantity: { gt: 0 },
      },
      include: {
        variant: { select: { id: true, sku: true, product: { select: { name: true } } } },
        warehouse: { select: { name: true } },
      },
    });

    const rows = stock
      .map((s) => {
        const soldQty = salesMap.get(s.variantId) ?? 0;
        return {
          variantId: s.variantId,
          productName: s.variant.product.name,
          sku: s.variant.sku,
          warehouseName: s.warehouse.name,
          stockQty: toNum(s.quantity),
          soldQty,
        };
      })
      .filter((r) => r.stockQty > 0 && r.soldQty <= thresholdQty)
      .sort((a, b) => b.stockQty - a.stockQty);

    return { rows: rows.slice(0, 50), thresholdQty };
  }

  static async getDeadStock(filters: ReportFilters) {
    const { rows: salesRows } = await this.getSalesByProduct({ ...filters, pageSize: 2000 });
    const soldVariants = new Set(salesRows.filter((r) => r.quantity > 0).map((r) => r.variantId));

    const stock = await prisma.stockLevel.findMany({
      where: {
        warehouse: {
          organizationId: filters.organizationId,
          deletedAt: null,
          ...branchWhere(filters.branchId),
        },
        quantity: { gt: 0 },
      },
      include: {
        variant: { select: { id: true, sku: true, product: { select: { name: true } } } },
        warehouse: { select: { name: true } },
      },
    });

    const rows = stock
      .filter((s) => !soldVariants.has(s.variantId))
      .map((s) => ({
        variantId: s.variantId,
        productName: s.variant.product.name,
        sku: s.variant.sku,
        warehouseName: s.warehouse.name,
        stockQty: toNum(s.quantity),
        stockValue: toNum(s.quantity) * toNum(s.avgCost),
      }))
      .sort((a, b) => b.stockValue - a.stockValue);

    return { rows: rows.slice(0, 50) };
  }

  // ─── Statements ──────────────────────────────────────────

  static async getCustomerStatement(customerId: string, filters: ReportFilters) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: filters.organizationId },
      select: { id: true, code: true, name: true },
    });
    if (!customer) return null;

    const entries = await prisma.customerLedger.findMany({
      where: {
        customerId,
        entryDate: { gte: filters.from, lte: filters.to },
      },
      orderBy: { entryDate: "asc" },
    });

    const opening = await prisma.customerLedger.findFirst({
      where: { customerId, entryDate: { lt: filters.from } },
      orderBy: { entryDate: "desc" },
    });

    return {
      customer,
      openingBalance: opening ? toNum(opening.balance) : 0,
      entries: entries.map((e) => ({
        entryDate: e.entryDate,
        description: e.description,
        debit: toNum(e.debit),
        credit: toNum(e.credit),
        balance: toNum(e.balance),
      })),
      closingBalance: entries.length > 0 ? toNum(entries[entries.length - 1].balance) : opening ? toNum(opening.balance) : 0,
    };
  }

  static async getSupplierStatement(supplierId: string, filters: ReportFilters) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: filters.organizationId },
      select: { id: true, code: true, name: true },
    });
    if (!supplier) return null;

    const entries = await prisma.supplierLedger.findMany({
      where: {
        supplierId,
        entryDate: { gte: filters.from, lte: filters.to },
      },
      orderBy: { entryDate: "asc" },
    });

    const opening = await prisma.supplierLedger.findFirst({
      where: { supplierId, entryDate: { lt: filters.from } },
      orderBy: { entryDate: "desc" },
    });

    return {
      supplier,
      openingBalance: opening ? toNum(opening.balance) : 0,
      entries: entries.map((e) => ({
        entryDate: e.entryDate,
        description: e.description,
        debit: toNum(e.debit),
        credit: toNum(e.credit),
        balance: toNum(e.balance),
      })),
      closingBalance: entries.length > 0 ? toNum(entries[entries.length - 1].balance) : opening ? toNum(opening.balance) : 0,
    };
  }

  // ─── Tax ─────────────────────────────────────────────────

  static async getTaxReport(filters: ReportFilters) {
    const [sales, returns, invoices, saleLines, returnLines] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhere(filters),
        select: { taxAmount: true, subtotal: true, discountAmount: true, grandTotal: true },
      }),
      prisma.sale.findMany({
        where: {
          organizationId: filters.organizationId,
          deletedAt: null,
          status: "COMPLETED",
          saleType: "RETURN",
          ...branchWhere(filters.branchId),
          saleDate: { gte: filters.from, lte: filters.to },
        },
        select: { taxAmount: true, subtotal: true, discountAmount: true, grandTotal: true },
      }),
      prisma.supplierInvoice.findMany({
        where: {
          organizationId: filters.organizationId,
          invoiceDate: { gte: filters.from, lte: filters.to },
          status: { in: ["APPROVED", "COMPLETED"] },
        },
        select: { taxAmount: true, subtotal: true, totalAmount: true },
      }),
      prisma.saleLine.findMany({
        where: { sale: saleWhereByType(filters, "SALE") },
        select: {
          lineTotal: true,
          taxAmount: true,
          taxRate: { select: { rate: true } },
        },
      }),
      prisma.saleLine.findMany({
        where: { sale: saleWhereByType(filters, "RETURN") },
        select: {
          lineTotal: true,
          taxAmount: true,
          taxRate: { select: { rate: true } },
        },
      }),
    ]);

    const salesGrossSubtotal = sales.reduce((s, sale) => s + toNum(sale.subtotal), 0);
    const salesDiscount = sales.reduce((s, sale) => s + toNum(sale.discountAmount), 0);
    const salesTaxableBase = salesGrossSubtotal - salesDiscount;
    const outputTaxSales = sales.reduce((s, sale) => s + toNum(sale.taxAmount), 0);

    const returnGrossSubtotal = returns.reduce((s, sale) => s + toNum(sale.subtotal), 0);
    const returnDiscount = returns.reduce((s, sale) => s + toNum(sale.discountAmount), 0);
    const returnTaxableBase = returnGrossSubtotal - returnDiscount;
    const outputTaxReturns = returns.reduce((s, sale) => s + toNum(sale.taxAmount), 0);

    const netTaxableSales = salesTaxableBase - returnTaxableBase;
    const netOutputTax = outputTaxSales - outputTaxReturns;

    const purchaseSubtotal = invoices.reduce((s, inv) => s + toNum(inv.subtotal), 0);
    const inputTax = invoices.reduce((s, inv) => s + toNum(inv.taxAmount), 0);
    const netTax = netOutputTax - inputTax;

    const byRate = new Map<
      string,
      {
        rateKey: string;
        ratePercent: number;
        salesTaxableBase: number;
        salesTax: number;
        returnTaxableBase: number;
        returnTax: number;
      }
    >();

    const addByRate = (
      rows: { lineTotal: Decimal; taxAmount: Decimal; taxRate: { rate: Decimal } | null }[],
      kind: "SALE" | "RETURN",
    ) => {
      for (const row of rows) {
        const lineTotal = toNum(row.lineTotal);
        const taxAmount = toNum(row.taxAmount);
        const taxableBase = lineTotal - taxAmount;
        const explicitRate = row.taxRate ? toNum(row.taxRate.rate) : null;
        const derivedRate =
          explicitRate != null
            ? normalizeRatePercent(explicitRate)
            : taxableBase > 0 && taxAmount > 0
              ? normalizeRatePercent((taxAmount / taxableBase) * 100)
              : 0;
        const roundedRate = Math.round(derivedRate * 100) / 100;
        const key = roundedRate.toFixed(2);
        const bucket = byRate.get(key) ?? {
          rateKey: key,
          ratePercent: roundedRate,
          salesTaxableBase: 0,
          salesTax: 0,
          returnTaxableBase: 0,
          returnTax: 0,
        };
        if (kind === "RETURN") {
          bucket.returnTaxableBase += taxableBase;
          bucket.returnTax += taxAmount;
        } else {
          bucket.salesTaxableBase += taxableBase;
          bucket.salesTax += taxAmount;
        }
        byRate.set(key, bucket);
      }
    };

    addByRate(saleLines, "SALE");
    addByRate(returnLines, "RETURN");

    const outputByRate = Array.from(byRate.values())
      .map((r) => ({
        rateKey: r.rateKey,
        ratePercent: Math.round(r.ratePercent * 100) / 100,
        rateLabel: `${(Math.round(r.ratePercent * 100) / 100).toFixed(2)}%`,
        salesTaxableBase: r.salesTaxableBase,
        salesTax: r.salesTax,
        returnTaxableBase: r.returnTaxableBase,
        returnTax: r.returnTax,
        netTaxableBase: r.salesTaxableBase - r.returnTaxableBase,
        netOutputTax: r.salesTax - r.returnTax,
      }))
      .sort((a, b) => a.ratePercent - b.ratePercent);

    return {
      outputTax: netOutputTax,
      inputTax,
      netTax,
      salesSubtotal: netTaxableSales,
      purchaseSubtotal,
      salesGrossSubtotal,
      salesDiscount,
      salesTaxableBase,
      outputTaxSales,
      returnGrossSubtotal,
      returnDiscount,
      returnTaxableBase,
      outputTaxReturns,
      netTaxableSales,
      netOutputTax,
      outputByRate,
      salesCount: sales.length,
      returnCount: returns.length,
      invoiceCount: invoices.length,
    };
  }
}

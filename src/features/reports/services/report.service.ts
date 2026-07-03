import { prisma } from "@/infrastructure/database/prisma";
import { InventoryQueryService } from "@/features/inventory/services/inventory-query.service";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface ReportFilters {
  organizationId: string;
  branchId?: string;
  from: Date;
  to: Date;
  page?: number;
  pageSize?: number;
}

function saleWhere(filters: ReportFilters): Prisma.SaleWhereInput {
  return {
    organizationId: filters.organizationId,
    deletedAt: null,
    status: "COMPLETED",
    saleType: "SALE",
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
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

export class ReportService {
  // ─── Sales ───────────────────────────────────────────────

  static async getDailySales(filters: ReportFilters) {
    const sales = await prisma.sale.findMany({
      where: saleWhere(filters),
      select: {
        saleDate: true,
        grandTotal: true,
        taxAmount: true,
        discountAmount: true,
      },
    });

    const byDate = new Map<
      string,
      { date: string; transactionCount: number; totalSales: number; totalTax: number; totalDiscount: number }
    >();

    for (const s of sales) {
      const date = localDateKey(s.saleDate);
      const row = byDate.get(date) ?? {
        date,
        transactionCount: 0,
        totalSales: 0,
        totalTax: 0,
        totalDiscount: 0,
      };
      row.transactionCount += 1;
      row.totalSales += toNum(s.grandTotal);
      row.totalTax += toNum(s.taxAmount);
      row.totalDiscount += toNum(s.discountAmount);
      byDate.set(date, row);
    }

    const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    const totals = rows.reduce(
      (acc, r) => ({
        transactionCount: acc.transactionCount + r.transactionCount,
        totalSales: acc.totalSales + r.totalSales,
        totalTax: acc.totalTax + r.totalTax,
        totalDiscount: acc.totalDiscount + r.totalDiscount,
      }),
      { transactionCount: 0, totalSales: 0, totalTax: 0, totalDiscount: 0 },
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
      where: saleWhere(filters),
      select: {
        grandTotal: true,
        cashier: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    const byCashier = new Map<
      string,
      { cashierId: string; cashierName: string; transactionCount: number; totalSales: number }
    >();

    for (const s of sales) {
      const row = byCashier.get(s.cashier.id) ?? {
        cashierId: s.cashier.id,
        cashierName:
          [s.cashier.firstName, s.cashier.lastName].filter(Boolean).join(" ") || s.cashier.email,
        transactionCount: 0,
        totalSales: 0,
      };
      row.transactionCount += 1;
      row.totalSales += toNum(s.grandTotal);
      byCashier.set(s.cashier.id, row);
    }

    return { rows: Array.from(byCashier.values()).sort((a, b) => b.totalSales - a.totalSales) };
  }

  static async getSalesByPaymentMethod(filters: ReportFilters) {
    const payments = await prisma.payment.findMany({
      where: { sale: saleWhere(filters) },
      select: { method: true, amount: true, saleId: true },
    });

    const byMethod = new Map<string, { method: string; transactionCount: number; totalAmount: number; saleIds: Set<string> }>();

    for (const p of payments) {
      const row = byMethod.get(p.method) ?? {
        method: p.method,
        transactionCount: 0,
        totalAmount: 0,
        saleIds: new Set<string>(),
      };
      row.saleIds.add(p.saleId);
      row.totalAmount += toNum(p.amount);
      row.transactionCount = row.saleIds.size;
      byMethod.set(p.method, row);
    }

    return {
      rows: Array.from(byMethod.values())
        .map(({ saleIds: _, ...row }) => row)
        .sort((a, b) => b.totalAmount - a.totalAmount),
    };
  }

  // ─── Purchases ───────────────────────────────────────────

  static async getPurchaseSummary(filters: ReportFilters) {
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId: filters.organizationId,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
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
        ...(filters.branchId ? { warehouse: { branchId: filters.branchId } } : {}),
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
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
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
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
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
    const [sales, returns, invoices] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhere(filters),
        select: { taxAmount: true, subtotal: true, grandTotal: true },
      }),
      prisma.sale.findMany({
        where: {
          organizationId: filters.organizationId,
          deletedAt: null,
          status: "COMPLETED",
          saleType: "RETURN",
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
          saleDate: { gte: filters.from, lte: filters.to },
        },
        select: { taxAmount: true, subtotal: true, grandTotal: true },
      }),
      prisma.supplierInvoice.findMany({
        where: {
          organizationId: filters.organizationId,
          invoiceDate: { gte: filters.from, lte: filters.to },
          status: { in: ["APPROVED", "COMPLETED"] },
        },
        select: { taxAmount: true, subtotal: true, totalAmount: true },
      }),
    ]);

    const salesTax = sales.reduce((s, sale) => s + toNum(sale.taxAmount), 0);
    const returnTax = returns.reduce((s, sale) => s + toNum(sale.taxAmount), 0);
    const outputTax = salesTax - returnTax;
    const inputTax = invoices.reduce((s, inv) => s + toNum(inv.taxAmount), 0);
    const salesSubtotal =
      sales.reduce((s, sale) => s + toNum(sale.subtotal), 0) -
      returns.reduce((s, sale) => s + toNum(sale.subtotal), 0);
    const purchaseSubtotal = invoices.reduce((s, inv) => s + toNum(inv.subtotal), 0);

    return {
      outputTax,
      inputTax,
      netTax: outputTax - inputTax,
      salesSubtotal,
      purchaseSubtotal,
      salesCount: sales.length,
      returnCount: returns.length,
      invoiceCount: invoices.length,
    };
  }
}

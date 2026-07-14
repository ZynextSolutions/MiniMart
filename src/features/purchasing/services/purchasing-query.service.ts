import { prisma } from "@/infrastructure/database/prisma";
import type { BranchFilter } from "@/lib/auth/branch-access";
import { prismaBranchWhere } from "@/lib/auth/branch-access";
import { SupplierLedgerService } from "@/lib/services/supplier-ledger-service";
import type { Prisma } from "@prisma/client";

export type PurchasingListFilters = {
  organizationId: string;
  branchId?: BranchFilter;
  status?: string;
};

export class PurchasingQueryService {
  static async listPurchaseRequests(filters: PurchasingListFilters) {
    // PurchaseRequest has no branchId; scope by creator's current assignments is weak.
    // Keep org-wide for requests (planning docs) — no branch column to filter.
    return prisma.purchaseRequest.findMany({
      where: { organizationId: filters.organizationId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { lines: true } } },
    });
  }

  static async getPurchaseRequestDetail(id: string, organizationId: string) {
    const pr = await prisma.purchaseRequest.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });
    if (!pr) return null;

    const variantIds = pr.lines.map((l) => l.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        sku: true,
        name: true,
        product: { select: { name: true, unit: { select: { abbreviation: true } } } },
      },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    return {
      ...pr,
      lines: pr.lines.map((l) => ({
        ...l,
        variant: variantMap.get(l.variantId),
      })),
    };
  }

  static async listPurchaseOrders(filters: PurchasingListFilters) {
    return prisma.purchaseOrder.findMany({
      where: {
        organizationId: filters.organizationId,
        ...prismaBranchWhere(filters.branchId),
        ...(filters.status
          ? { status: filters.status as Prisma.EnumDocumentStatusFilter["equals"] }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        _count: { select: { lines: true, goodsReceipts: true } },
      },
    });
  }

  static async getPurchaseOrderDetail(id: string, organizationId: string) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: {
        supplier: true,
        lines: true,
        goodsReceipts: {
          include: { _count: { select: { lines: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!po) return null;

    const variantIds = po.lines.map((l) => l.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        sku: true,
        name: true,
        product: { select: { name: true, unit: { select: { abbreviation: true } } } },
      },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    return {
      ...po,
      lines: po.lines.map((l) => ({
        ...l,
        variant: variantMap.get(l.variantId),
      })),
    };
  }

  static async listGoodsReceipts(filters: PurchasingListFilters) {
    let warehouseIds: string[] | undefined;
    if (filters.branchId) {
      const warehouses = await prisma.warehouse.findMany({
        where: {
          organizationId: filters.organizationId,
          deletedAt: null,
          branchId: filters.branchId,
        },
        select: { id: true },
      });
      warehouseIds = warehouses.map((w) => w.id);
      if (warehouseIds.length === 0) return [];
    }

    return prisma.goodsReceipt.findMany({
      where: {
        organizationId: filters.organizationId,
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        purchaseOrder: { select: { orderNumber: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  static async listSupplierInvoices(filters: PurchasingListFilters) {
    // Supplier invoices are org-level AP documents (no branch column).
    return prisma.supplierInvoice.findMany({
      where: { organizationId: filters.organizationId },
      orderBy: { invoiceDate: "desc" },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  static async getOutstandingPayables(organizationId: string) {
    return SupplierLedgerService.getOutstandingPayables(organizationId);
  }

  static async getSupplierStatement(supplierId: string, organizationId: string) {
    return SupplierLedgerService.getStatement(supplierId, organizationId);
  }
}

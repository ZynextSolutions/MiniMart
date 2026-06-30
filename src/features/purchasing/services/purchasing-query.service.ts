import { prisma } from "@/infrastructure/database/prisma";
import { SupplierLedgerService } from "@/lib/services/supplier-ledger-service";
import type { Prisma } from "@prisma/client";

export class PurchasingQueryService {
  static async listPurchaseRequests(organizationId: string) {
    return prisma.purchaseRequest.findMany({
      where: { organizationId },
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

  static async listPurchaseOrders(organizationId: string, status?: string) {
    return prisma.purchaseOrder.findMany({
      where: {
        organizationId,
        ...(status ? { status: status as Prisma.EnumDocumentStatusFilter["equals"] } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
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

  static async listGoodsReceipts(organizationId: string) {
    return prisma.goodsReceipt.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        purchaseOrder: { select: { orderNumber: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  static async listSupplierInvoices(organizationId: string) {
    return prisma.supplierInvoice.findMany({
      where: { organizationId },
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

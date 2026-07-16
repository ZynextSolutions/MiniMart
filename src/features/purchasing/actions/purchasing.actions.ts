"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/infrastructure/database/prisma";
import { requireSession, requireModuleSession, authorizeSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getErrorMessage } from "@/lib/errors/app-error";
import { PurchasingService } from "@/lib/services/purchasing-service";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";

const invoiceLineSchema = z.object({
  goodsReceiptLineId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  taxAmount: z.number().nonnegative().optional(),
});

const receiptLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  taxAmount: z.number().nonnegative().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

function ctx(session: Awaited<ReturnType<typeof requireSession>>) {
  if (!session.user.branchId) throw new Error("No branch selected");
  return {
    organizationId: session.user.organizationId,
    branchId: session.user.branchId,
    userId: session.user.id,
  };
}

async function requirePurchasingSession(permission: string) {
  const session = await requireModuleSession("purchasing");
  await authorizeSession(session, permission);
  return session;
}

// ─── Purchase Requests ─────────────────────────────────────

export async function listPurchaseRequestsAction(params?: { branchId?: string }) {
  const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.REQUEST_CREATE);
  return PurchasingQueryService.listPurchaseRequests({
    organizationId: session.user.organizationId,
    branchId: resolveSessionBranchFilter(session.user, params?.branchId),
  });
}

export async function createPurchaseRequestAction(input: {
  requestDate: string;
  notes?: string;
  lines: { variantId: string; quantity: number; estimatedCost: number }[];
}) {
  try {
    const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.REQUEST_CREATE);
    const pr = await PurchasingService.createPurchaseRequest(
      { ...input, requestDate: new Date(input.requestDate) },
      ctx(session),
    );
    revalidatePath("/purchasing/requests");
    return { success: true, pr };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function submitPurchaseRequestAction(id: string) {
  try {
    const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.REQUEST_CREATE);
    await PurchasingService.submitPurchaseRequest(id, ctx(session));
    revalidatePath("/purchasing/requests");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function approvePurchaseRequestAction(id: string) {
  try {
    const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.REQUEST_APPROVE);
    await PurchasingService.approvePurchaseRequest(id, ctx(session));
    revalidatePath("/purchasing/requests");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function createPOFromRequestAction(requestId: string, supplierId: string) {
  try {
    const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.ORDER_CREATE);
    const po = await PurchasingService.createPOFromRequest(requestId, supplierId, ctx(session));
    revalidatePath("/purchasing/orders");
    return { success: true, po };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Purchase Orders ───────────────────────────────────────

export async function listPurchaseOrdersAction(params?: {
  status?: string;
  branchId?: string;
}) {
  const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.ORDER_CREATE);
  return PurchasingQueryService.listPurchaseOrders({
    organizationId: session.user.organizationId,
    status: params?.status,
    branchId: resolveSessionBranchFilter(session.user, params?.branchId),
  });
}

export async function getPurchaseOrderAction(id: string) {
  const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.ORDER_CREATE);
  return PurchasingQueryService.getPurchaseOrderDetail(id, session.user.organizationId);
}

export async function createPurchaseOrderAction(input: {
  supplierId: string;
  orderDate: string;
  expectedDate?: string;
  notes?: string;
  lines: { variantId: string; quantity: number; unitCost: number; taxAmount?: number }[];
}) {
  try {
    const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.ORDER_CREATE);
    const po = await PurchasingService.createPurchaseOrder(
      {
        ...input,
        orderDate: new Date(input.orderDate),
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : undefined,
      },
      ctx(session),
    );
    revalidatePath("/purchasing/orders");
    return { success: true, po };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function submitPurchaseOrderAction(id: string) {
  try {
    const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.ORDER_CREATE);
    await PurchasingService.submitPurchaseOrder(id, ctx(session));
    revalidatePath("/purchasing/orders");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function approvePurchaseOrderAction(id: string) {
  try {
    const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.ORDER_APPROVE);
    await PurchasingService.approvePurchaseOrder(id, ctx(session));
    revalidatePath("/purchasing/orders");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Goods Receipt ─────────────────────────────────────────

export async function listGoodsReceiptsAction(params?: { branchId?: string }) {
  const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.RECEIVE);
  return PurchasingQueryService.listGoodsReceipts({
    organizationId: session.user.organizationId,
    branchId: resolveSessionBranchFilter(session.user, params?.branchId),
  });
}

export async function createGoodsReceiptAction(input: {
  warehouseId: string;
  purchaseOrderId?: string;
  receiptDate: string;
  notes?: string;
  lines: z.infer<typeof receiptLineSchema>[];
}) {
  try {
    const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.RECEIVE);
    const data = {
      ...input,
      receiptDate: new Date(input.receiptDate),
      lines: z.array(receiptLineSchema).parse(input.lines),
    };
    const receipt = await PurchasingService.createGoodsReceipt(data, ctx(session));
    revalidatePath("/purchasing/receiving");
    revalidatePath("/inventory");
    return { success: true, receiptNumber: receipt.receiptNumber };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Supplier Invoices ─────────────────────────────────────

export async function listSupplierInvoicesAction(params?: { branchId?: string }) {
  const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.INVOICE_MANAGE);
  return PurchasingQueryService.listSupplierInvoices({
    organizationId: session.user.organizationId,
    branchId: resolveSessionBranchFilter(session.user, params?.branchId),
  });
}

export async function listInvoiceableGoodsReceiptsAction(supplierId?: string) {
  const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.INVOICE_MANAGE);
  return PurchasingQueryService.listInvoiceableGoodsReceipts(
    session.user.organizationId,
    supplierId,
  );
}

export async function getGoodsReceiptForInvoicingAction(id: string) {
  const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.INVOICE_MANAGE);
  return PurchasingQueryService.getGoodsReceiptForInvoicing(id, session.user.organizationId);
}

export async function createSupplierInvoiceAction(input: {
  supplierId: string;
  goodsReceiptId: string;
  supplierRef?: string;
  invoiceDate: string;
  dueDate: string;
  lines: z.infer<typeof invoiceLineSchema>[];
}) {
  try {
    const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.INVOICE_MANAGE);
    const invoice = await PurchasingService.createSupplierInvoice(
      {
        ...input,
        invoiceDate: new Date(input.invoiceDate),
        dueDate: new Date(input.dueDate),
        lines: z.array(invoiceLineSchema).parse(input.lines),
      },
      ctx(session),
    );
    revalidatePath("/purchasing/invoices");
    revalidatePath("/purchasing/payables");
    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function recordSupplierPaymentAction(input: {
  supplierId: string;
  invoiceId?: string;
  amount: number;
  paymentDate: string;
  method: "CASH" | "BANK";
  reference?: string;
}) {
  try {
    const session = await requirePurchasingSession(PERMISSIONS.SUPPLIERS.PAYMENT);
    const result = await PurchasingService.recordSupplierPayment(
      { ...input, paymentDate: new Date(input.paymentDate) },
      ctx(session),
    );
    revalidatePath("/purchasing/invoices");
    revalidatePath("/purchasing/payables");
    return { success: true, ...result };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Supplier Return ───────────────────────────────────────

export async function createSupplierReturnAction(input: {
  supplierId: string;
  warehouseId: string;
  returnDate: string;
  notes?: string;
  lines: { variantId: string; quantity: number; unitCost: number }[];
}) {
  try {
    const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.RETURN);
    const result = await PurchasingService.createSupplierReturn(
      { ...input, returnDate: new Date(input.returnDate) },
      ctx(session),
    );
    revalidatePath("/purchasing/returns");
    revalidatePath("/inventory");
    return { success: true, ...result };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Payables ──────────────────────────────────────────────

export async function getOutstandingPayablesAction() {
  const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.INVOICE_MANAGE);
  return PurchasingQueryService.getOutstandingPayables(session.user.organizationId);
}

export async function searchVariantsForPurchasingAction(query: string) {
  const session = await requirePurchasingSession(PERMISSIONS.PURCHASING.ORDER_CREATE);
  if (!query.trim()) return [];

  return prisma.productVariant.findMany({
    where: {
      deletedAt: null,
      product: { organizationId: session.user.organizationId, deletedAt: null },
      OR: [
        { sku: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
        { product: { name: { contains: query, mode: "insensitive" } } },
      ],
    },
    take: 15,
    select: {
      id: true,
      sku: true,
      name: true,
      costPrice: true,
      product: { select: { name: true, unit: { select: { abbreviation: true } } } },
    },
  });
}
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/infrastructure/database/prisma";
import { requireSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getErrorMessage } from "@/lib/errors/app-error";
import { PurchasingService } from "@/lib/services/purchasing-service";
import { PurchasingQueryService } from "@/features/purchasing/services/purchasing-query.service";

const lineSchema = z.object({
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

// ─── Purchase Requests ─────────────────────────────────────

export async function listPurchaseRequestsAction() {
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.PURCHASING.REQUEST_CREATE);
  return PurchasingQueryService.listPurchaseRequests(session.user.organizationId);
}

export async function createPurchaseRequestAction(input: {
  requestDate: string;
  notes?: string;
  lines: { variantId: string; quantity: number; estimatedCost: number }[];
}) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.PURCHASING.REQUEST_CREATE);
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
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.PURCHASING.REQUEST_CREATE);
    await PurchasingService.submitPurchaseRequest(id, ctx(session));
    revalidatePath("/purchasing/requests");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function approvePurchaseRequestAction(id: string) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.PURCHASING.REQUEST_APPROVE);
    await PurchasingService.approvePurchaseRequest(id, ctx(session));
    revalidatePath("/purchasing/requests");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function createPOFromRequestAction(requestId: string, supplierId: string) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.PURCHASING.ORDER_CREATE);
    const po = await PurchasingService.createPOFromRequest(requestId, supplierId, ctx(session));
    revalidatePath("/purchasing/orders");
    return { success: true, po };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Purchase Orders ───────────────────────────────────────

export async function listPurchaseOrdersAction(status?: string) {
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.PURCHASING.ORDER_CREATE);
  return PurchasingQueryService.listPurchaseOrders(session.user.organizationId, status);
}

export async function getPurchaseOrderAction(id: string) {
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.PURCHASING.ORDER_CREATE);
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
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.PURCHASING.ORDER_CREATE);
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
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.PURCHASING.ORDER_CREATE);
    await PurchasingService.submitPurchaseOrder(id, ctx(session));
    revalidatePath("/purchasing/orders");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function approvePurchaseOrderAction(id: string) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.PURCHASING.ORDER_APPROVE);
    await PurchasingService.approvePurchaseOrder(id, ctx(session));
    revalidatePath("/purchasing/orders");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Goods Receipt ─────────────────────────────────────────

export async function listGoodsReceiptsAction() {
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.PURCHASING.RECEIVE);
  return PurchasingQueryService.listGoodsReceipts(session.user.organizationId);
}

export async function createGoodsReceiptAction(input: {
  warehouseId: string;
  purchaseOrderId?: string;
  receiptDate: string;
  notes?: string;
  lines: z.infer<typeof lineSchema>[];
}) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.PURCHASING.RECEIVE);
    const data = {
      ...input,
      receiptDate: new Date(input.receiptDate),
      lines: z.array(lineSchema).parse(input.lines),
    };
    const receipt = await PurchasingService.createGoodsReceipt(data, ctx(session));
    revalidatePath("/purchasing/receiving");
    revalidatePath("/inventory");
    return { success: true, receipt };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

// ─── Supplier Invoices ─────────────────────────────────────

export async function listSupplierInvoicesAction() {
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.PURCHASING.INVOICE_MANAGE);
  return PurchasingQueryService.listSupplierInvoices(session.user.organizationId);
}

export async function createSupplierInvoiceAction(input: {
  supplierId: string;
  supplierRef?: string;
  invoiceDate: string;
  dueDate: string;
  lines: { variantId: string; quantity: number; unitCost: number; taxAmount?: number }[];
}) {
  try {
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.PURCHASING.INVOICE_MANAGE);
    const invoice = await PurchasingService.createSupplierInvoice(
      {
        ...input,
        invoiceDate: new Date(input.invoiceDate),
        dueDate: new Date(input.dueDate),
      },
      ctx(session),
    );
    revalidatePath("/purchasing/invoices");
    revalidatePath("/purchasing/payables");
    return { success: true, invoice };
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
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.PURCHASING.INVOICE_MANAGE);
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
    const session = await requireSession();
    await authorize(session.user.id, PERMISSIONS.PURCHASING.RETURN);
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
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.PURCHASING.INVOICE_MANAGE);
  return PurchasingQueryService.getOutstandingPayables(session.user.organizationId);
}

export async function searchVariantsForPurchasingAction(query: string) {
  const session = await requireSession();
  await authorize(session.user.id, PERMISSIONS.PURCHASING.ORDER_CREATE);
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
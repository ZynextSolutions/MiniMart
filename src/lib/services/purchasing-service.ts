import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { AccountingEngine } from "@/lib/services/accounting-engine";
import { AuditService } from "@/lib/services/audit-service";
import { InventoryService } from "@/lib/services/inventory-service";
import { NotificationService } from "@/lib/services/notification-service";
import { generatePurchaseDocumentNumber } from "@/lib/services/purchase-document-number";
import { SupplierLedgerService } from "@/lib/services/supplier-ledger-service";
import {
  assertSupplierBelongsToOrg,
  assertVariantsBelongToOrg,
  assertWarehouseAccess,
} from "@/lib/services/variant-access";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";

type Tx = Prisma.TransactionClient;

export interface ServiceContext {
  organizationId: string;
  branchId: string;
  userId: string;
}

export interface LineInput {
  variantId: string;
  quantity: number;
  unitCost: number;
  taxAmount?: number;
  batchNumber?: string;
  expiryDate?: string;
}

function lineTotal(qty: number, cost: number, tax = 0) {
  return qty * cost + tax;
}

export class PurchasingService {
  // ─── Purchase Requests ─────────────────────────────────────

  static async createPurchaseRequest(
    input: { requestDate: Date; notes?: string; lines: { variantId: string; quantity: number; estimatedCost: number }[] },
    ctx: ServiceContext,
  ) {
    if (input.lines.length === 0) throw new ValidationError("At least one line required");

    await assertVariantsBelongToOrg(
      ctx.organizationId,
      input.lines.map((l) => l.variantId),
    );

    const requestNumber = await generatePurchaseDocumentNumber("PR", ctx.organizationId);

    const pr = await prisma.purchaseRequest.create({
      data: {
        organizationId: ctx.organizationId,
        requestNumber,
        requestDate: input.requestDate,
        notes: input.notes,
        status: "DRAFT",
        createdById: ctx.userId,
        lines: {
          create: input.lines.map((l) => ({
            variantId: l.variantId,
            quantity: new Decimal(l.quantity),
            estimatedCost: new Decimal(l.estimatedCost),
          })),
        },
      },
      include: { lines: true },
    });

    await AuditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "purchasing.request.created",
      entityType: "PurchaseRequest",
      entityId: pr.id,
      after: { requestNumber },
    });

    return pr;
  }

  static async submitPurchaseRequest(id: string, ctx: ServiceContext) {
    const pr = await this.getPurchaseRequest(id, ctx.organizationId);
    if (pr.status !== "DRAFT") throw new ConflictError("Only draft requests can be submitted");

    return prisma.purchaseRequest.update({
      where: { id },
      data: { status: "PENDING" },
    });
  }

  static async approvePurchaseRequest(id: string, ctx: ServiceContext) {
    const pr = await this.getPurchaseRequest(id, ctx.organizationId);
    if (pr.status !== "PENDING") throw new ConflictError("Only pending requests can be approved");

    const updated = await prisma.purchaseRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    await AuditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "purchasing.request.approved",
      entityType: "PurchaseRequest",
      entityId: id,
    });

    return updated;
  }

  static async createPOFromRequest(requestId: string, supplierId: string, ctx: ServiceContext) {
    await assertSupplierBelongsToOrg(ctx.organizationId, supplierId);

    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: requestId, organizationId: ctx.organizationId, status: "APPROVED" },
      include: { lines: true },
    });
    if (!pr) throw new NotFoundError("Approved purchase request");

    return this.createPurchaseOrder(
      {
        supplierId,
        orderDate: new Date(),
        notes: `From ${pr.requestNumber}`,
        lines: pr.lines.map((l) => ({
          variantId: l.variantId,
          quantity: Number(l.quantity),
          unitCost: Number(l.estimatedCost),
        })),
      },
      ctx,
    );
  }

  // ─── Purchase Orders ───────────────────────────────────────

  static async createPurchaseOrder(
    input: {
      supplierId: string;
      orderDate: Date;
      expectedDate?: Date;
      notes?: string;
      lines: { variantId: string; quantity: number; unitCost: number; taxAmount?: number }[];
    },
    ctx: ServiceContext,
  ) {
    if (input.lines.length === 0) throw new ValidationError("At least one line required");

    await assertSupplierBelongsToOrg(ctx.organizationId, input.supplierId);
    await assertVariantsBelongToOrg(
      ctx.organizationId,
      input.lines.map((l) => l.variantId),
    );

    const orderNumber = await generatePurchaseDocumentNumber("PO", ctx.organizationId);
    let subtotal = 0;
    let taxAmount = 0;

    const lineData = input.lines.map((l) => {
      const tax = l.taxAmount ?? 0;
      const total = lineTotal(l.quantity, l.unitCost, tax);
      subtotal += l.quantity * l.unitCost;
      taxAmount += tax;
      return {
        variantId: l.variantId,
        quantity: new Decimal(l.quantity),
        unitCost: new Decimal(l.unitCost),
        taxAmount: new Decimal(tax),
        lineTotal: new Decimal(total),
      };
    });

    const po = await prisma.purchaseOrder.create({
      data: {
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
        supplierId: input.supplierId,
        orderNumber,
        orderDate: input.orderDate,
        expectedDate: input.expectedDate,
        notes: input.notes,
        status: "DRAFT",
        subtotal: new Decimal(subtotal),
        taxAmount: new Decimal(taxAmount),
        totalAmount: new Decimal(subtotal + taxAmount),
        createdById: ctx.userId,
        lines: { create: lineData },
      },
      include: { lines: true, supplier: true },
    });

    await AuditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "purchasing.order.created",
      entityType: "PurchaseOrder",
      entityId: po.id,
      after: { orderNumber },
    });

    return po;
  }

  static async submitPurchaseOrder(id: string, ctx: ServiceContext) {
    const po = await this.getPurchaseOrder(id, ctx.organizationId);
    if (po.status !== "DRAFT") throw new ConflictError("Only draft orders can be submitted");

    return prisma.purchaseOrder.update({ where: { id }, data: { status: "PENDING" } });
  }

  static async approvePurchaseOrder(id: string, ctx: ServiceContext) {
    const po = await this.getPurchaseOrder(id, ctx.organizationId);
    if (po.status !== "PENDING") throw new ConflictError("Only pending orders can be approved");

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    await AuditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "purchasing.order.approved",
      entityType: "PurchaseOrder",
      entityId: id,
    });

    return updated;
  }

  // ─── Goods Receipt ─────────────────────────────────────────

  static async createGoodsReceipt(
    input: {
      warehouseId: string;
      purchaseOrderId?: string;
      receiptDate: Date;
      notes?: string;
      lines: LineInput[];
    },
    ctx: ServiceContext,
  ) {
    if (input.lines.length === 0) throw new ValidationError("At least one line required");

    const warehouse = await assertWarehouseAccess(
      ctx.organizationId,
      input.warehouseId,
      { branchId: ctx.branchId },
    );
    await assertVariantsBelongToOrg(
      ctx.organizationId,
      input.lines.map((l) => l.variantId),
    );

    if (input.purchaseOrderId) {
      const po = await this.getPurchaseOrder(input.purchaseOrderId, ctx.organizationId);
      if (!["APPROVED", "COMPLETED"].includes(po.status)) {
        throw new ConflictError("Purchase order must be approved to receive");
      }
    }

    const receiptNumber = await generatePurchaseDocumentNumber("GRN", ctx.organizationId);

    const receipt = await prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          organizationId: ctx.organizationId,
          purchaseOrderId: input.purchaseOrderId,
          warehouseId: input.warehouseId,
          receiptNumber,
          receiptDate: input.receiptDate,
          notes: input.notes,
          status: "COMPLETED",
          createdById: ctx.userId,
          lines: {
            create: input.lines.map((l) => ({
              variantId: l.variantId,
              quantity: new Decimal(l.quantity),
              unitCost: new Decimal(l.unitCost),
              batchNumber: l.batchNumber,
              expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
            })),
          },
        },
        include: { lines: true },
      });

      await InventoryService.processPurchaseReceipt(tx, {
        warehouseId: input.warehouseId,
        goodsReceiptId: receipt.id,
        organizationId: ctx.organizationId,
        branchId: warehouse.branchId,
        userId: ctx.userId,
        lines: input.lines,
      });

      if (input.purchaseOrderId) {
        for (const line of input.lines) {
          const poLine = await tx.purchaseOrderLine.findFirst({
            where: { purchaseOrderId: input.purchaseOrderId, variantId: line.variantId },
          });
          if (poLine) {
            const newReceived = poLine.receivedQty.add(line.quantity);
            await tx.purchaseOrderLine.update({
              where: { id: poLine.id },
              data: { receivedQty: newReceived },
            });
          }
        }

        const poLines = await tx.purchaseOrderLine.findMany({
          where: { purchaseOrderId: input.purchaseOrderId },
        });
        const allReceived = poLines.every((l) => l.receivedQty.gte(l.quantity));
        if (allReceived) {
          await tx.purchaseOrder.update({
            where: { id: input.purchaseOrderId },
            data: { status: "COMPLETED" },
          });
        }
      }

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "purchasing.goods-received",
        entityType: "GoodsReceipt",
        entityId: receipt.id,
        after: { receiptNumber, lineCount: input.lines.length },
      });

      return receipt;
    });

    void NotificationService.notifyNewPurchaseArrival({
      organizationId: ctx.organizationId,
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      lineCount: input.lines.length,
      warehouseName: warehouse.name,
      excludeUserId: ctx.userId,
    }).catch(() => {});

    return receipt;
  }

  // ─── Supplier Invoice ──────────────────────────────────────

  static async createSupplierInvoice(
    input: {
      supplierId: string;
      supplierRef?: string;
      invoiceDate: Date;
      dueDate: Date;
      lines: { variantId: string; quantity: number; unitCost: number; taxAmount?: number }[];
    },
    ctx: ServiceContext,
  ) {
    if (input.lines.length === 0) throw new ValidationError("At least one line required");

    await assertSupplierBelongsToOrg(ctx.organizationId, input.supplierId);
    await assertVariantsBelongToOrg(
      ctx.organizationId,
      input.lines.map((l) => l.variantId),
    );

    const invoiceNumber = await generatePurchaseDocumentNumber("AP", ctx.organizationId);
    let subtotal = 0;
    let taxAmount = 0;

    const lineData = input.lines.map((l) => {
      const tax = l.taxAmount ?? 0;
      const total = lineTotal(l.quantity, l.unitCost, tax);
      subtotal += l.quantity * l.unitCost;
      taxAmount += tax;
      return {
        variantId: l.variantId,
        quantity: new Decimal(l.quantity),
        unitCost: new Decimal(l.unitCost),
        taxAmount: new Decimal(tax),
        lineTotal: new Decimal(total),
      };
    });

    const totalAmount = subtotal + taxAmount;

    return prisma.$transaction(async (tx) => {
      const invoice = await tx.supplierInvoice.create({
        data: {
          organizationId: ctx.organizationId,
          supplierId: input.supplierId,
          invoiceNumber,
          supplierRef: input.supplierRef,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
          status: "APPROVED",
          subtotal: new Decimal(subtotal),
          taxAmount: new Decimal(taxAmount),
          totalAmount: new Decimal(totalAmount),
          paidAmount: new Decimal(0),
          createdById: ctx.userId,
          lines: { create: lineData },
        },
        include: { lines: true, supplier: true },
      });

      await AccountingEngine.postPurchaseInvoice(tx, {
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
        userId: ctx.userId,
        invoiceId: invoice.id,
        invoiceDate: input.invoiceDate,
        subtotal,
        taxAmount,
        totalAmount,
      });

      await SupplierLedgerService.addEntry(
        {
          supplierId: input.supplierId,
          entryDate: input.invoiceDate,
          description: `Invoice ${invoiceNumber}`,
          debit: totalAmount,
          credit: 0,
          referenceType: "SupplierInvoice",
          referenceId: invoice.id,
        },
        tx,
      );

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "purchasing.invoice.created",
        entityType: "SupplierInvoice",
        entityId: invoice.id,
        after: { invoiceNumber, totalAmount },
      });

      return invoice;
    });
  }

  // ─── Supplier Payment ──────────────────────────────────────

  static async recordSupplierPayment(
    input: {
      supplierId: string;
      invoiceId?: string;
      amount: number;
      paymentDate: Date;
      method: "CASH" | "BANK";
      reference?: string;
    },
    ctx: ServiceContext,
  ) {
    if (input.amount <= 0) throw new ValidationError("Amount must be positive");

    const paymentId = randomUUID();

    return prisma.$transaction(async (tx) => {
      if (input.invoiceId) {
        const invoice = await tx.supplierInvoice.findFirst({
          where: { id: input.invoiceId, organizationId: ctx.organizationId },
        });
        if (!invoice) throw new NotFoundError("Supplier invoice");

        const outstanding = invoice.totalAmount.sub(invoice.paidAmount);
        if (new Decimal(input.amount).gt(outstanding)) {
          throw new ValidationError("Payment exceeds outstanding amount");
        }

        const newPaid = invoice.paidAmount.add(input.amount);
        await tx.supplierInvoice.update({
          where: { id: input.invoiceId },
          data: {
            paidAmount: newPaid,
            status: newPaid.gte(invoice.totalAmount) ? "COMPLETED" : invoice.status,
          },
        });
      }

      await AccountingEngine.postSupplierPayment(tx, {
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
        userId: ctx.userId,
        paymentId,
        paymentDate: input.paymentDate,
        amount: input.amount,
        method: input.method,
      });

      await SupplierLedgerService.addEntry(
        {
          supplierId: input.supplierId,
          entryDate: input.paymentDate,
          description: input.reference ?? `Payment ${paymentId.slice(0, 8)}`,
          debit: 0,
          credit: input.amount,
          referenceType: "SupplierPayment",
          referenceId: paymentId,
        },
        tx,
      );

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "purchasing.payment.recorded",
        entityType: "SupplierPayment",
        entityId: paymentId,
        after: { amount: input.amount, invoiceId: input.invoiceId },
      });

      return { paymentId, amount: input.amount };
    });
  }

  // ─── Supplier Return ───────────────────────────────────────

  static async createSupplierReturn(
    input: {
      supplierId: string;
      warehouseId: string;
      returnDate: Date;
      notes?: string;
      lines: { variantId: string; quantity: number; unitCost: number }[];
    },
    ctx: ServiceContext,
  ) {
    if (input.lines.length === 0) throw new ValidationError("At least one line required");

    await assertSupplierBelongsToOrg(ctx.organizationId, input.supplierId);
    const warehouse = await assertWarehouseAccess(
      ctx.organizationId,
      input.warehouseId,
      { branchId: ctx.branchId },
    );
    await assertVariantsBelongToOrg(
      ctx.organizationId,
      input.lines.map((l) => l.variantId),
    );

    const returnId = randomUUID();
    const totalValue = input.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

    return prisma.$transaction(async (tx) => {
      await InventoryService.processSupplierReturn(tx, {
        warehouseId: input.warehouseId,
        returnId,
        organizationId: ctx.organizationId,
        branchId: warehouse.branchId,
        userId: ctx.userId,
        lines: input.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      });

      await SupplierLedgerService.addEntry(
        {
          supplierId: input.supplierId,
          entryDate: input.returnDate,
          description: input.notes ?? `Supplier return ${returnId.slice(0, 8)}`,
          debit: 0,
          credit: totalValue,
          referenceType: "SupplierReturn",
          referenceId: returnId,
        },
        tx,
      );

      await AccountingEngine.postSupplierReturn(tx, {
        organizationId: ctx.organizationId,
        branchId: warehouse.branchId,
        userId: ctx.userId,
        returnId,
        returnDate: input.returnDate,
        totalValue,
      });

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "purchasing.return.created",
        entityType: "SupplierReturn",
        entityId: returnId,
        after: { totalValue, lineCount: input.lines.length },
      });

      return { returnId, totalValue };
    });
  }

  // ─── Helpers ───────────────────────────────────────────────

  static async getPurchaseRequest(id: string, organizationId: string) {
    const pr = await prisma.purchaseRequest.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          include: {
            purchaseRequest: false,
          },
        },
      },
    });
    if (!pr) throw new NotFoundError("Purchase request");
    return pr;
  }

  static async getPurchaseOrder(id: string, organizationId: string) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: {
        supplier: true,
        lines: true,
        goodsReceipts: { include: { _count: { select: { lines: true } } } },
      },
    });
    if (!po) throw new NotFoundError("Purchase order");
    return po;
  }
}

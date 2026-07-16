import type { GrnInvoicingStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { add, div, mul, sub, toDecimal, ZERO } from "@/lib/utils/decimal";

type Tx = Prisma.TransactionClient;

export interface InvoiceLineInput {
  goodsReceiptLineId: string;
  variantId: string;
  quantity: number;
  unitCost: number;
  taxAmount?: number;
}

export interface ReconciliationLineResult {
  goodsReceiptLineId: string;
  variantId: string;
  quantity: number;
  grnUnitCost: number;
  invoiceUnitCost: number;
  grnLineTotal: number;
  invoiceLineTotal: number;
  variance: number;
}

export interface ReconciliationResult {
  grnSubtotal: number;
  invoiceSubtotal: number;
  varianceAmount: number;
  reconciliationStatus: GrnInvoicingStatus;
  lines: ReconciliationLineResult[];
}

export class PurchaseReconciliationService {
  static calculateLineVariance(
    quantity: number,
    grnUnitCost: number,
    invoiceUnitCost: number,
  ): ReconciliationLineResult["variance"] {
    return quantity * (invoiceUnitCost - grnUnitCost);
  }

  static buildReconciliation(
    grnLines: { id: string; variantId: string; quantity: Decimal; invoicedQty: Decimal; unitCost: Decimal }[],
    invoiceLines: InvoiceLineInput[],
  ): ReconciliationResult {
    const grnMap = new Map(grnLines.map((l) => [l.id, l]));
    const results: ReconciliationLineResult[] = [];
    let grnSubtotal = 0;
    let invoiceSubtotal = 0;

    for (const line of invoiceLines) {
      const grnLine = grnMap.get(line.goodsReceiptLineId);
      if (!grnLine) {
        throw new ValidationError("Invoice line must reference a goods receipt line");
      }
      if (grnLine.variantId !== line.variantId) {
        throw new ValidationError("Invoice line variant does not match goods receipt line");
      }

      const remaining = sub(grnLine.quantity, grnLine.invoicedQty);
      const qty = toDecimal(line.quantity);
      if (qty.lte(ZERO)) throw new ValidationError("Invoice quantity must be positive");
      if (qty.gt(remaining)) {
        throw new ValidationError(
          `Invoice quantity exceeds uninvoiced receipt quantity for variant ${line.variantId}`,
        );
      }

      const grnUnitCost = Number(grnLine.unitCost);
      const invoiceUnitCost = line.unitCost;
      const qtyNum = Number(qty);
      const grnLineTotal = qtyNum * grnUnitCost;
      const invoiceLineTotal = qtyNum * invoiceUnitCost;
      const variance = this.calculateLineVariance(qtyNum, grnUnitCost, invoiceUnitCost);

      grnSubtotal += grnLineTotal;
      invoiceSubtotal += invoiceLineTotal;
      results.push({
        goodsReceiptLineId: line.goodsReceiptLineId,
        variantId: line.variantId,
        quantity: qtyNum,
        grnUnitCost,
        invoiceUnitCost,
        grnLineTotal,
        invoiceLineTotal,
        variance,
      });
    }

    const varianceAmount = invoiceSubtotal - grnSubtotal;
    const allFullyInvoiced = grnLines.every((grnLine) => {
      const invoicedInThisRun = results
        .filter((r) => r.goodsReceiptLineId === grnLine.id)
        .reduce((sum, r) => sum + r.quantity, 0);
      return Number(grnLine.invoicedQty) + invoicedInThisRun >= Number(grnLine.quantity);
    });

    const anyInvoiced = grnLines.some((grnLine) => {
      const invoicedInThisRun = results
        .filter((r) => r.goodsReceiptLineId === grnLine.id)
        .reduce((sum, r) => sum + r.quantity, 0);
      return Number(grnLine.invoicedQty) + invoicedInThisRun > 0;
    });

    let reconciliationStatus: GrnInvoicingStatus = "PENDING";
    if (allFullyInvoiced) reconciliationStatus = "RECONCILED";
    else if (anyInvoiced) reconciliationStatus = "PARTIAL";

    return {
      grnSubtotal,
      invoiceSubtotal,
      varianceAmount,
      reconciliationStatus,
      lines: results,
    };
  }

  static async getGoodsReceiptForInvoice(
    tx: Tx,
    goodsReceiptId: string,
    organizationId: string,
  ) {
    const grn = await tx.goodsReceipt.findFirst({
      where: { id: goodsReceiptId, organizationId, status: "COMPLETED" },
      include: {
        lines: true,
        purchaseOrder: { select: { id: true, supplierId: true } },
      },
    });
    if (!grn) throw new NotFoundError("Goods receipt");
    if (grn.invoicingStatus === "RECONCILED") {
      throw new ConflictError("Goods receipt is already fully invoiced");
    }
    return grn;
  }

  static async reconcileInventoryCost(
    tx: Tx,
    params: {
      goodsReceiptId: string;
      warehouseId: string;
      lines: ReconciliationLineResult[];
    },
  ): Promise<void> {
    const movement = await tx.inventoryMovement.findFirst({
      where: {
        referenceType: "GoodsReceipt",
        referenceId: params.goodsReceiptId,
      },
      include: { lines: true },
    });

    for (const line of params.lines) {
      if (Math.abs(line.variance) < 0.0001) continue;

      const stockLevel = await tx.stockLevel.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId: params.warehouseId,
            variantId: line.variantId,
          },
        },
      });
      if (!stockLevel || stockLevel.quantity.lte(ZERO)) continue;

      if (stockLevel.costingMethod === "WEIGHTED_AVERAGE") {
        const costDelta = mul(line.quantity, line.invoiceUnitCost - line.grnUnitCost);
        const newAvgCost = add(stockLevel.avgCost, div(costDelta, stockLevel.quantity));
        const updated = await tx.stockLevel.updateMany({
          where: { id: stockLevel.id, version: stockLevel.version },
          data: {
            avgCost: newAvgCost,
            version: { increment: 1 },
          },
        });
        if (updated.count === 0) {
          throw new ConflictError("Stock level was modified during cost reconciliation. Please retry.");
        }
        continue;
      }

      const movementLine = movement?.lines.find((ml) => ml.variantId === line.variantId);
      if (movementLine?.batchId) {
        await tx.productBatch.update({
          where: { id: movementLine.batchId },
          data: { costPrice: new Decimal(line.invoiceUnitCost) },
        });
      }
    }
  }

  static async applyGrnInvoicingUpdates(
    tx: Tx,
    goodsReceiptId: string,
    reconciliation: ReconciliationResult,
  ): Promise<void> {
    for (const line of reconciliation.lines) {
      const grnLine = await tx.goodsReceiptLine.findUniqueOrThrow({
        where: { id: line.goodsReceiptLineId },
      });
      const newInvoicedQty = add(grnLine.invoicedQty, line.quantity);
      if (newInvoicedQty.gt(grnLine.quantity)) {
        throw new ValidationError("Invoiced quantity exceeds received quantity");
      }
      await tx.goodsReceiptLine.update({
        where: { id: line.goodsReceiptLineId },
        data: { invoicedQty: newInvoicedQty },
      });
    }

    const grnLines = await tx.goodsReceiptLine.findMany({
      where: { goodsReceiptId },
    });
    const status = grnLines.every((l) => l.invoicedQty.gte(l.quantity))
      ? "RECONCILED"
      : grnLines.some((l) => l.invoicedQty.gt(ZERO))
        ? "PARTIAL"
        : "PENDING";

    await tx.goodsReceipt.update({
      where: { id: goodsReceiptId },
      data: { invoicingStatus: status },
    });
  }
}

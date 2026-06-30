import type { CostingMethod } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { InsufficientStockError } from "@/lib/errors/app-error";
import { add, div, mul, sub, toDecimal, ZERO } from "@/lib/utils/decimal";

type Tx = Prisma.TransactionClient;

export interface StockInCostResult {
  unitCost: Decimal;
  totalCost: Decimal;
  batchId?: string;
}

export interface StockOutCostResult {
  unitCost: Decimal;
  totalCost: Decimal;
  batchConsumptions: { batchId: string; quantity: Decimal; unitCost: Decimal }[];
}

export class CostingEngine {
  static calculateWeightedAverageCost(
    existingQty: Decimal,
    existingAvgCost: Decimal,
    incomingQty: Decimal,
    incomingCost: Decimal,
  ): Decimal {
    const totalQty = add(existingQty, incomingQty);
    if (totalQty.lte(ZERO)) return incomingCost;
    const existingValue = mul(existingQty, existingAvgCost);
    const incomingValue = mul(incomingQty, incomingCost);
    return div(add(existingValue, incomingValue), totalQty);
  }

  static async processStockIn(
    tx: Tx,
    params: {
      variantId: string;
      warehouseId: string;
      quantity: Decimal;
      unitCost: Decimal;
      costingMethod: CostingMethod;
      batchNumber?: string;
      expiryDate?: Date;
    },
  ): Promise<StockInCostResult> {
    const { variantId, quantity, unitCost, costingMethod, batchNumber, expiryDate } = params;
    const totalCost = mul(quantity, unitCost);

    if (costingMethod === "FIFO") {
      const batch = await tx.productBatch.create({
        data: {
          variantId,
          batchNumber: batchNumber ?? `BATCH-${Date.now()}`,
          expiryDate: expiryDate ?? null,
          costPrice: unitCost,
          quantity,
          remainingQty: quantity,
          receivedAt: new Date(),
        },
      });
      return { unitCost, totalCost, batchId: batch.id };
    }

    return { unitCost, totalCost };
  }

  static async processStockOut(
    tx: Tx,
    params: {
      variantId: string;
      warehouseId: string;
      quantity: Decimal;
      costingMethod: CostingMethod;
      avgCost: Decimal;
    },
  ): Promise<StockOutCostResult> {
    const { variantId, quantity, costingMethod, avgCost } = params;

    if (costingMethod === "WEIGHTED_AVERAGE") {
      return {
        unitCost: avgCost,
        totalCost: mul(quantity, avgCost),
        batchConsumptions: [],
      };
    }

    const batches = await tx.productBatch.findMany({
      where: { variantId, remainingQty: { gt: 0 } },
      orderBy: [{ receivedAt: "asc" }, { expiryDate: "asc" }],
    });

    let remaining = toDecimal(quantity);
    let totalCost = ZERO;
    const batchConsumptions: StockOutCostResult["batchConsumptions"] = [];

    for (const batch of batches) {
      if (remaining.lte(ZERO)) break;

      const batchRemaining = toDecimal(batch.remainingQty);
      const consumeQty = Decimal.min(remaining, batchRemaining);
      const lineCost = mul(consumeQty, batch.costPrice);

      await tx.productBatch.update({
        where: { id: batch.id },
        data: { remainingQty: sub(batchRemaining, consumeQty) },
      });

      batchConsumptions.push({
        batchId: batch.id,
        quantity: consumeQty,
        unitCost: batch.costPrice,
      });

      totalCost = add(totalCost, lineCost);
      remaining = sub(remaining, consumeQty);
    }

    if (remaining.gt(ZERO)) {
      throw new InsufficientStockError(
        variantId,
        sub(quantity, remaining).toString(),
        quantity.toString(),
      );
    }

    const unitCost = quantity.gt(ZERO) ? div(totalCost, quantity) : ZERO;
    return { unitCost, totalCost, batchConsumptions };
  }
}

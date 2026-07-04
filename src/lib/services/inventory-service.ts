import { prisma } from "@/infrastructure/database/prisma";
import {
  ConflictError,
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import { CostingEngine } from "@/lib/services/costing-engine";
import { generateDocumentNumber } from "@/lib/services/document-number";
import { NotificationService } from "@/lib/services/notification-service";
import {
  assertVariantsBelongToOrg,
  assertWarehouseBelongsToOrg,
} from "@/lib/services/variant-access";
import { add, isPositive, sub, toDecimal, ZERO } from "@/lib/utils/decimal";
import type { CostingMethod, MovementType, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";

type Tx = Prisma.TransactionClient;

export interface MovementLineInput {
  variantId: string;
  quantity: number;
  unitCost?: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface ServiceContext {
  organizationId: string;
  branchId?: string | null;
  userId: string;
}

import { ADJUSTMENT_REASONS } from "@/features/inventory/constants/adjustment-reasons";

export { ADJUSTMENT_REASONS };

export class InventoryService {
  private static async getOrCreateStockLevel(
    tx: Tx,
    warehouseId: string,
    variantId: string,
    costingMethod: CostingMethod = "WEIGHTED_AVERAGE",
  ) {
    const existing = await tx.stockLevel.findUnique({
      where: { warehouseId_variantId: { warehouseId, variantId } },
    });
    if (existing) return existing;

    return tx.stockLevel.create({
      data: { warehouseId, variantId, quantity: ZERO, avgCost: ZERO, costingMethod },
    });
  }

  private static async updateStockLevel(
    tx: Tx,
    stockLevelId: string,
    version: number,
    quantityDelta: Decimal,
    newAvgCost?: Decimal,
  ) {
    const updated = await tx.stockLevel.updateMany({
      where: { id: stockLevelId, version },
      data: {
        quantity: { increment: quantityDelta },
        ...(newAvgCost !== undefined ? { avgCost: newAvgCost } : {}),
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new ConflictError("Stock level was modified by another process. Please retry.");
    }
  }

  private static async writeLedger(
    tx: Tx,
    params: {
      warehouseId: string;
      variantId: string;
      movementType: MovementType;
      quantity: Decimal;
      balanceAfter: Decimal;
      unitCost: Decimal;
      referenceType: string;
      referenceId: string;
    },
  ) {
    await tx.inventoryLedger.create({ data: params });
  }

  private static async processLineIn(
    tx: Tx,
    ctx: {
      warehouseId: string;
      movementId: string;
      movementType: MovementType;
      referenceType: string;
      referenceId: string;
      line: MovementLineInput;
    },
  ) {
    const quantity = toDecimal(ctx.line.quantity);
    if (!isPositive(quantity)) throw new ValidationError("Quantity must be positive");

    const variant = await tx.productVariant.findFirst({
      where: { id: ctx.line.variantId, deletedAt: null, product: { deletedAt: null } },
      include: { product: { select: { costPrice: true, trackBatch: true, trackExpiry: true, reorderLevel: true, name: true } } },
    });
    if (!variant) throw new NotFoundError("Product variant");

    const unitCost = toDecimal(ctx.line.unitCost ?? variant.costPrice ?? variant.product.costPrice);
    const stockLevel = await this.getOrCreateStockLevel(tx, ctx.warehouseId, ctx.line.variantId);

    const costResult = await CostingEngine.processStockIn(tx, {
      variantId: ctx.line.variantId,
      warehouseId: ctx.warehouseId,
      quantity,
      unitCost,
      costingMethod: stockLevel.costingMethod,
      batchNumber: ctx.line.batchNumber,
      expiryDate: ctx.line.expiryDate ? new Date(ctx.line.expiryDate) : undefined,
    });

    const newAvgCost =
      stockLevel.costingMethod === "WEIGHTED_AVERAGE"
        ? CostingEngine.calculateWeightedAverageCost(
            stockLevel.quantity,
            stockLevel.avgCost,
            quantity,
            unitCost,
          )
        : stockLevel.avgCost;

    await this.updateStockLevel(tx, stockLevel.id, stockLevel.version, quantity, newAvgCost);

    const newBalance = add(stockLevel.quantity, quantity);
    await tx.inventoryMovementLine.create({
      data: {
        movementId: ctx.movementId,
        variantId: ctx.line.variantId,
        batchId: costResult.batchId,
        quantity,
        unitCost,
        totalCost: costResult.totalCost,
      },
    });

    await this.writeLedger(tx, {
      warehouseId: ctx.warehouseId,
      variantId: ctx.line.variantId,
      movementType: ctx.movementType,
      quantity,
      balanceAfter: newBalance,
      unitCost,
      referenceType: ctx.referenceType,
      referenceId: ctx.referenceId,
    });

    if (ctx.line.expiryDate) {
      const expiry = new Date(ctx.line.expiryDate);
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + 30);
      if (expiry <= warningDate) {
        await NotificationService.notifyExpiryWarning({
          organizationId: (await tx.warehouse.findUniqueOrThrow({ where: { id: ctx.warehouseId } })).organizationId,
          variantId: ctx.line.variantId,
          productName: variant.product.name,
          batchNumber: ctx.line.batchNumber ?? "N/A",
          expiryDate: expiry,
          remainingQty: quantity,
        });
      }
    }

    return { variant, newBalance, reorderLevel: variant.product.reorderLevel };
  }

  private static async processLineOut(
    tx: Tx,
    ctx: {
      warehouseId: string;
      movementId: string;
      movementType: MovementType;
      referenceType: string;
      referenceId: string;
      line: MovementLineInput;
      organizationId: string;
    },
  ) {
    const quantity = toDecimal(ctx.line.quantity);
    if (!isPositive(quantity)) throw new ValidationError("Quantity must be positive");

    const variant = await tx.productVariant.findFirst({
      where: { id: ctx.line.variantId, deletedAt: null },
      include: {
        product: { select: { reorderLevel: true, name: true } },
      },
    });
    if (!variant) throw new NotFoundError("Product variant");

    const stockLevel = await tx.stockLevel.findUnique({
      where: { warehouseId_variantId: { warehouseId: ctx.warehouseId, variantId: ctx.line.variantId } },
    });

    if (!stockLevel || stockLevel.quantity.lt(quantity)) {
      throw new InsufficientStockError(
        ctx.line.variantId,
        stockLevel?.quantity.toString() ?? "0",
        quantity.toString(),
      );
    }

    const costResult = await CostingEngine.processStockOut(tx, {
      variantId: ctx.line.variantId,
      warehouseId: ctx.warehouseId,
      quantity,
      costingMethod: stockLevel.costingMethod,
      avgCost: stockLevel.avgCost,
    });

    await this.updateStockLevel(tx, stockLevel.id, stockLevel.version, quantity.neg());

    const newBalance = sub(stockLevel.quantity, quantity);
    const primaryBatchId = costResult.batchConsumptions[0]?.batchId;

    await tx.inventoryMovementLine.create({
      data: {
        movementId: ctx.movementId,
        variantId: ctx.line.variantId,
        batchId: primaryBatchId,
        quantity,
        unitCost: costResult.unitCost,
        totalCost: costResult.totalCost,
      },
    });

    await this.writeLedger(tx, {
      warehouseId: ctx.warehouseId,
      variantId: ctx.line.variantId,
      movementType: ctx.movementType,
      quantity: quantity.neg(),
      balanceAfter: newBalance,
      unitCost: costResult.unitCost,
      referenceType: ctx.referenceType,
      referenceId: ctx.referenceId,
    });

    const warehouse = await tx.warehouse.findUniqueOrThrow({
      where: { id: ctx.warehouseId },
      select: { name: true },
    });

    if (newBalance.lte(variant.product.reorderLevel) && variant.product.reorderLevel.gt(ZERO)) {
      await NotificationService.notifyLowStock({
        organizationId: ctx.organizationId,
        variantId: ctx.line.variantId,
        productName: variant.product.name,
        warehouseName: warehouse.name,
        quantity: newBalance,
        reorderLevel: variant.product.reorderLevel,
      });
    }

    return { newBalance };
  }

  static async stockIn(
    input: {
      warehouseId: string;
      movementDate: Date;
      notes?: string;
      lines: MovementLineInput[];
    },
    ctx: ServiceContext,
  ) {
    if (input.lines.length === 0) throw new ValidationError("At least one line is required");

    await assertVariantsBelongToOrg(
      ctx.organizationId,
      input.lines.map((l) => l.variantId),
    );

    return prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findFirstOrThrow({
        where: { id: input.warehouseId, organizationId: ctx.organizationId },
      });
      const movementNumber = await generateDocumentNumber("STK-IN", ctx.organizationId);
      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: warehouse.branchId,
          warehouseId: input.warehouseId,
          movementNumber,
          movementType: "STOCK_IN",
          movementDate: input.movementDate,
          notes: input.notes,
          status: "COMPLETED",
          createdById: ctx.userId,
          referenceType: "STOCK_IN",
        },
      });

      for (const line of input.lines) {
        await this.processLineIn(tx, {
          warehouseId: input.warehouseId,
          movementId: movement.id,
          movementType: "STOCK_IN",
          referenceType: "INVENTORY_MOVEMENT",
          referenceId: movement.id,
          line,
        });
      }

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "inventory.stock-in",
        entityType: "InventoryMovement",
        entityId: movement.id,
        after: { movementNumber, lineCount: input.lines.length },
      });

      return movement;
    });
  }

  static async stockOut(
    input: {
      warehouseId: string;
      movementDate: Date;
      notes?: string;
      lines: MovementLineInput[];
    },
    ctx: ServiceContext,
  ) {
    if (input.lines.length === 0) throw new ValidationError("At least one line is required");

    await assertVariantsBelongToOrg(
      ctx.organizationId,
      input.lines.map((l) => l.variantId),
    );

    return prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findFirstOrThrow({
        where: { id: input.warehouseId, organizationId: ctx.organizationId },
      });
      const movementNumber = await generateDocumentNumber("STK-OUT", ctx.organizationId);
      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: warehouse.branchId,
          warehouseId: input.warehouseId,
          movementNumber,
          movementType: "STOCK_OUT",
          movementDate: input.movementDate,
          notes: input.notes,
          status: "COMPLETED",
          createdById: ctx.userId,
          referenceType: "STOCK_OUT",
        },
      });

      for (const line of input.lines) {
        await this.processLineOut(tx, {
          warehouseId: input.warehouseId,
          movementId: movement.id,
          movementType: "STOCK_OUT",
          referenceType: "INVENTORY_MOVEMENT",
          referenceId: movement.id,
          line,
          organizationId: ctx.organizationId,
        });
      }

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "inventory.stock-out",
        entityType: "InventoryMovement",
        entityId: movement.id,
        after: { movementNumber, lineCount: input.lines.length },
      });

      return movement;
    });
  }

  static async adjust(
    input: {
      warehouseId: string;
      movementDate: Date;
      reasonCode: string;
      notes?: string;
      lines: { variantId: string; quantity: number; direction: "IN" | "OUT"; unitCost?: number }[];
    },
    ctx: ServiceContext,
  ) {
    if (input.lines.length === 0) throw new ValidationError("At least one line is required");

    await assertVariantsBelongToOrg(
      ctx.organizationId,
      input.lines.map((l) => l.variantId),
    );

    const notes = [input.reasonCode, input.notes].filter(Boolean).join(" — ");
    const inLines = input.lines.filter((l) => l.direction === "IN");
    const outLines = input.lines.filter((l) => l.direction === "OUT");
    const movementNumbers: string[] = [];

    return prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findFirstOrThrow({
        where: { id: input.warehouseId, organizationId: ctx.organizationId },
      });

      if (inLines.length > 0) {
        const movementNumber = await generateDocumentNumber("ADJ", ctx.organizationId);
        movementNumbers.push(movementNumber);

        const movement = await tx.inventoryMovement.create({
          data: {
            organizationId: ctx.organizationId,
            branchId: warehouse.branchId,
            warehouseId: input.warehouseId,
            movementNumber,
            movementType: "ADJUSTMENT_IN",
            movementDate: input.movementDate,
            notes,
            status: "COMPLETED",
            createdById: ctx.userId,
            referenceType: "ADJUSTMENT",
          },
        });

        for (const line of inLines) {
          await this.processLineIn(tx, {
            warehouseId: input.warehouseId,
            movementId: movement.id,
            movementType: "ADJUSTMENT_IN",
            referenceType: "INVENTORY_MOVEMENT",
            referenceId: movement.id,
            line: { variantId: line.variantId, quantity: line.quantity, unitCost: line.unitCost },
          });
        }
      }

      if (outLines.length > 0) {
        const movementNumber = await generateDocumentNumber("ADJ", ctx.organizationId);
        movementNumbers.push(movementNumber);

        const movement = await tx.inventoryMovement.create({
          data: {
            organizationId: ctx.organizationId,
            branchId: warehouse.branchId,
            warehouseId: input.warehouseId,
            movementNumber,
            movementType: "ADJUSTMENT_OUT",
            movementDate: input.movementDate,
            notes,
            status: "COMPLETED",
            createdById: ctx.userId,
            referenceType: "ADJUSTMENT",
          },
        });

        for (const line of outLines) {
          await this.processLineOut(tx, {
            warehouseId: input.warehouseId,
            movementId: movement.id,
            movementType: "ADJUSTMENT_OUT",
            referenceType: "INVENTORY_MOVEMENT",
            referenceId: movement.id,
            line: { variantId: line.variantId, quantity: line.quantity },
            organizationId: ctx.organizationId,
          });
        }
      }

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "inventory.adjust",
        entityType: "InventoryMovement",
        entityId: movementNumbers[0] ?? "ADJ",
        after: { reasonCode: input.reasonCode, movementNumbers, lineCount: input.lines.length },
      });

      return { movementNumbers };
    });
  }

  static async transfer(
    input: {
      sourceWarehouseId: string;
      destWarehouseId: string;
      movementDate: Date;
      notes?: string;
      lines: MovementLineInput[];
    },
    ctx: ServiceContext,
  ) {
    if (input.sourceWarehouseId === input.destWarehouseId) {
      throw new ValidationError("Source and destination warehouses must differ");
    }
    if (input.lines.length === 0) throw new ValidationError("At least one line is required");

    await assertVariantsBelongToOrg(
      ctx.organizationId,
      input.lines.map((l) => l.variantId),
    );

    const transferGroupId = randomUUID();

    return prisma.$transaction(async (tx) => {
      const sourceWarehouse = await tx.warehouse.findFirstOrThrow({
        where: { id: input.sourceWarehouseId, organizationId: ctx.organizationId },
      });
      const destWarehouse = await tx.warehouse.findFirstOrThrow({
        where: { id: input.destWarehouseId, organizationId: ctx.organizationId },
      });

      const outNumber = await generateDocumentNumber("TRF", ctx.organizationId);
      const inNumber = `${outNumber}-IN`;

      const outMovement = await tx.inventoryMovement.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: sourceWarehouse.branchId,
          warehouseId: input.sourceWarehouseId,
          movementNumber: outNumber,
          movementType: "TRANSFER_OUT",
          movementDate: input.movementDate,
          notes: input.notes,
          status: "COMPLETED",
          createdById: ctx.userId,
          referenceType: "TRANSFER",
          referenceId: transferGroupId,
        },
      });

      const inMovement = await tx.inventoryMovement.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: destWarehouse.branchId,
          warehouseId: input.destWarehouseId,
          movementNumber: inNumber,
          movementType: "TRANSFER_IN",
          movementDate: input.movementDate,
          notes: input.notes,
          status: "COMPLETED",
          createdById: ctx.userId,
          referenceType: "TRANSFER",
          referenceId: transferGroupId,
        },
      });

      for (const line of input.lines) {
        const quantity = toDecimal(line.quantity);
        if (!isPositive(quantity)) throw new ValidationError("Quantity must be positive");

        const sourceLevel = await tx.stockLevel.findUnique({
          where: {
            warehouseId_variantId: {
              warehouseId: input.sourceWarehouseId,
              variantId: line.variantId,
            },
          },
        });

        if (!sourceLevel || sourceLevel.quantity.lt(quantity)) {
          throw new InsufficientStockError(
            line.variantId,
            sourceLevel?.quantity.toString() ?? "0",
            quantity.toString(),
          );
        }

        const costResult = await CostingEngine.processStockOut(tx, {
          variantId: line.variantId,
          warehouseId: input.sourceWarehouseId,
          quantity,
          costingMethod: sourceLevel.costingMethod,
          avgCost: sourceLevel.avgCost,
        });

        await this.updateStockLevel(tx, sourceLevel.id, sourceLevel.version, quantity.neg());
        const sourceBalance = sub(sourceLevel.quantity, quantity);

        await tx.inventoryMovementLine.create({
          data: {
            movementId: outMovement.id,
            variantId: line.variantId,
            quantity,
            unitCost: costResult.unitCost,
            totalCost: costResult.totalCost,
          },
        });

        await this.writeLedger(tx, {
          warehouseId: input.sourceWarehouseId,
          variantId: line.variantId,
          movementType: "TRANSFER_OUT",
          quantity: quantity.neg(),
          balanceAfter: sourceBalance,
          unitCost: costResult.unitCost,
          referenceType: "TRANSFER",
          referenceId: transferGroupId,
        });

        const destLevel = await this.getOrCreateStockLevel(
          tx,
          input.destWarehouseId,
          line.variantId,
          sourceLevel.costingMethod,
        );

        const transferCost = costResult.unitCost;
        const newDestAvg =
          destLevel.costingMethod === "WEIGHTED_AVERAGE"
            ? CostingEngine.calculateWeightedAverageCost(
                destLevel.quantity,
                destLevel.avgCost,
                quantity,
                transferCost,
              )
            : destLevel.avgCost;

        if (destLevel.costingMethod === "FIFO") {
          await CostingEngine.processStockIn(tx, {
            variantId: line.variantId,
            warehouseId: input.destWarehouseId,
            quantity,
            unitCost: transferCost,
            costingMethod: "FIFO",
            batchNumber: `TRF-${outNumber}`,
          });
        }

        await this.updateStockLevel(tx, destLevel.id, destLevel.version, quantity, newDestAvg);
        const destBalance = add(destLevel.quantity, quantity);

        await tx.inventoryMovementLine.create({
          data: {
            movementId: inMovement.id,
            variantId: line.variantId,
            quantity,
            unitCost: transferCost,
            totalCost: costResult.totalCost,
          },
        });

        await this.writeLedger(tx, {
          warehouseId: input.destWarehouseId,
          variantId: line.variantId,
          movementType: "TRANSFER_IN",
          quantity,
          balanceAfter: destBalance,
          unitCost: transferCost,
          referenceType: "TRANSFER",
          referenceId: transferGroupId,
        });
      }

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "inventory.transfer",
        entityType: "InventoryMovement",
        entityId: transferGroupId,
        after: { outNumber, inNumber, lineCount: input.lines.length },
      });

      return { outMovement, inMovement, transferGroupId };
    });
  }

  static async initializeStockLevels(warehouseId: string, organizationId: string, actorId: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId, deletedAt: null },
    });
    if (!warehouse) throw new NotFoundError("Warehouse");

    const variants = await prisma.productVariant.findMany({
      where: { deletedAt: null, product: { organizationId, deletedAt: null } },
      select: { id: true },
    });

    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const variant of variants) {
        const exists = await tx.stockLevel.findUnique({
          where: { warehouseId_variantId: { warehouseId, variantId: variant.id } },
        });
        if (!exists) {
          await tx.stockLevel.create({
            data: { warehouseId, variantId: variant.id, quantity: ZERO, avgCost: ZERO },
          });
          created++;
        }
      }
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "inventory.initialize",
      entityType: "Warehouse",
      entityId: warehouseId,
      after: { created },
    });

    return { created, total: variants.length };
  }

  static async createStockCount(
    input: { warehouseId: string; countDate: Date; notes?: string },
    ctx: ServiceContext,
  ) {
    await assertWarehouseBelongsToOrg(ctx.organizationId, input.warehouseId);

    const countNumber = await generateDocumentNumber("CNT", ctx.organizationId);

    const stockLevels = await prisma.stockLevel.findMany({
      where: { warehouseId: input.warehouseId },
      select: { variantId: true, quantity: true },
    });

    const linesData =
      stockLevels.length > 0
        ? stockLevels.map((sl) => ({
            variantId: sl.variantId,
            systemQty: sl.quantity,
            countedQty: sl.quantity,
            variance: ZERO,
          }))
        : (
            await prisma.productVariant.findMany({
              where: {
                deletedAt: null,
                product: { organizationId: ctx.organizationId, deletedAt: null },
              },
              select: { id: true },
            })
          ).map((v) => ({
            variantId: v.id,
            systemQty: ZERO,
            countedQty: ZERO,
            variance: ZERO,
          }));

    return prisma.$transaction(async (tx) => {
      const stockCount = await tx.stockCount.create({
        data: {
          warehouseId: input.warehouseId,
          countNumber,
          countDate: input.countDate,
          notes: input.notes,
          status: "DRAFT",
          createdById: ctx.userId,
          lines: { create: linesData },
        },
        include: { lines: true },
      });

      await AuditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "inventory.stock-count.created",
        entityType: "StockCount",
        entityId: stockCount.id,
        after: { countNumber },
      });

      return stockCount;
    });
  }

  static async updateStockCountLines(
    stockCountId: string,
    lines: { id: string; countedQty: number }[],
    organizationId: string,
  ) {
    const stockCount = await prisma.stockCount.findFirst({
      where: { id: stockCountId, status: "DRAFT" },
      include: { warehouse: { select: { organizationId: true } } },
    });
    if (!stockCount || stockCount.warehouse.organizationId !== organizationId) {
      throw new NotFoundError("Stock count");
    }

    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const existing = await tx.stockCountLine.findFirst({
          where: { id: line.id, stockCountId },
        });
        if (!existing) continue;

        const countedQty = toDecimal(line.countedQty);
        const variance = sub(countedQty, existing.systemQty);

        await tx.stockCountLine.update({
          where: { id: line.id },
          data: { countedQty, variance },
        });
      }
    });
  }

  static async completeStockCount(stockCountId: string, ctx: ServiceContext) {
    const stockCount = await prisma.stockCount.findFirst({
      where: { id: stockCountId, status: "DRAFT" },
      include: {
        lines: true,
        warehouse: { select: { id: true, organizationId: true } },
      },
    });

    if (!stockCount || stockCount.warehouse.organizationId !== ctx.organizationId) {
      throw new NotFoundError("Stock count");
    }

    const adjustmentLines = stockCount.lines
      .filter((l) => !toDecimal(l.variance).isZero())
      .map((l) => ({
        variantId: l.variantId,
        quantity: Math.abs(Number(l.variance)),
        direction: toDecimal(l.variance).gt(ZERO) ? ("IN" as const) : ("OUT" as const),
      }));

    if (adjustmentLines.length > 0) {
      await this.adjust(
        {
          warehouseId: stockCount.warehouseId,
          movementDate: stockCount.countDate,
          reasonCode: "COUNT_VARIANCE",
          notes: `Stock count ${stockCount.countNumber}`,
          lines: adjustmentLines,
        },
        ctx,
      );
    }

    await prisma.stockCount.update({
      where: { id: stockCountId },
      data: { status: "COMPLETED" },
    });

    await AuditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "inventory.stock-count.completed",
      entityType: "StockCount",
      entityId: stockCountId,
      after: { adjustmentLines: adjustmentLines.length },
    });

    return stockCount;
  }

  static async processSaleDeduction(
    tx: Tx,
    params: {
      warehouseId: string;
      saleId: string;
      organizationId: string;
      branchId: string;
      userId: string;
      lines: { variantId: string; quantity: number }[];
    },
  ): Promise<{ totalCogs: Decimal }> {
    await assertVariantsBelongToOrg(
      params.organizationId,
      params.lines.map((l) => l.variantId),
    );

    let totalCogs = ZERO;
    const movementNumber = await generateDocumentNumber("STK-OUT", params.organizationId);

    const movement = await tx.inventoryMovement.create({
      data: {
        organizationId: params.organizationId,
        branchId: params.branchId,
        warehouseId: params.warehouseId,
        movementNumber,
        movementType: "SALE",
        movementDate: new Date(),
        referenceType: "Sale",
        referenceId: params.saleId,
        status: "COMPLETED",
        createdById: params.userId,
      },
    });

    for (const line of params.lines) {
      const quantity = toDecimal(line.quantity);
      const stockLevel = await tx.stockLevel.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId: params.warehouseId,
            variantId: line.variantId,
          },
        },
      });

      if (!stockLevel || stockLevel.quantity.lt(quantity)) {
        throw new InsufficientStockError(
          line.variantId,
          stockLevel?.quantity.toString() ?? "0",
          quantity.toString(),
        );
      }

      const costResult = await CostingEngine.processStockOut(tx, {
        variantId: line.variantId,
        warehouseId: params.warehouseId,
        quantity,
        costingMethod: stockLevel.costingMethod,
        avgCost: stockLevel.avgCost,
      });

      totalCogs = add(totalCogs, costResult.totalCost);
      await this.updateStockLevel(tx, stockLevel.id, stockLevel.version, quantity.neg());

      const newBalance = sub(stockLevel.quantity, quantity);

      await tx.inventoryMovementLine.create({
        data: {
          movementId: movement.id,
          variantId: line.variantId,
          batchId: costResult.batchConsumptions[0]?.batchId,
          quantity,
          unitCost: costResult.unitCost,
          totalCost: costResult.totalCost,
        },
      });

      await this.writeLedger(tx, {
        warehouseId: params.warehouseId,
        variantId: line.variantId,
        movementType: "SALE",
        quantity: quantity.neg(),
        balanceAfter: newBalance,
        unitCost: costResult.unitCost,
        referenceType: "Sale",
        referenceId: params.saleId,
      });
    }

    return { totalCogs };
  }

  static async processReturnRestock(
    tx: Tx,
    params: {
      warehouseId: string;
      saleId: string;
      organizationId: string;
      branchId: string;
      userId: string;
      lines: { variantId: string; quantity: number; unitCost: number }[];
    },
  ): Promise<{ totalCogs: Decimal }> {
    await assertVariantsBelongToOrg(
      params.organizationId,
      params.lines.map((l) => l.variantId),
    );

    let totalCogs = ZERO;
    const movementNumber = await generateDocumentNumber("STK-IN", params.organizationId);

    const movement = await tx.inventoryMovement.create({
      data: {
        organizationId: params.organizationId,
        branchId: params.branchId,
        warehouseId: params.warehouseId,
        movementNumber,
        movementType: "RETURN_IN",
        movementDate: new Date(),
        referenceType: "SaleReturn",
        referenceId: params.saleId,
        status: "COMPLETED",
        createdById: params.userId,
      },
    });

    for (const line of params.lines) {
      await this.processLineIn(tx, {
        warehouseId: params.warehouseId,
        movementId: movement.id,
        movementType: "RETURN_IN",
        referenceType: "SaleReturn",
        referenceId: params.saleId,
        line: {
          variantId: line.variantId,
          quantity: line.quantity,
          unitCost: line.unitCost,
        },
      });
      totalCogs = add(totalCogs, toDecimal(line.unitCost * line.quantity));
    }

    return { totalCogs };
  }

  static async processPurchaseReceipt(
    tx: Tx,
    params: {
      warehouseId: string;
      goodsReceiptId: string;
      organizationId: string;
      branchId: string;
      userId: string;
      lines: {
        variantId: string;
        quantity: number;
        unitCost: number;
        batchNumber?: string;
        expiryDate?: string;
      }[];
    },
  ) {
    await assertVariantsBelongToOrg(
      params.organizationId,
      params.lines.map((l) => l.variantId),
    );

    const movementNumber = await generateDocumentNumber("STK-IN", params.organizationId);

    const movement = await tx.inventoryMovement.create({
      data: {
        organizationId: params.organizationId,
        branchId: params.branchId,
        warehouseId: params.warehouseId,
        movementNumber,
        movementType: "PURCHASE",
        movementDate: new Date(),
        referenceType: "GoodsReceipt",
        referenceId: params.goodsReceiptId,
        status: "COMPLETED",
        createdById: params.userId,
      },
    });

    for (const line of params.lines) {
      await this.processLineIn(tx, {
        warehouseId: params.warehouseId,
        movementId: movement.id,
        movementType: "PURCHASE",
        referenceType: "GoodsReceipt",
        referenceId: params.goodsReceiptId,
        line: {
          variantId: line.variantId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          batchNumber: line.batchNumber,
          expiryDate: line.expiryDate,
        },
      });
    }

    return movement;
  }

  static async processSupplierReturn(
    tx: Tx,
    params: {
      warehouseId: string;
      returnId: string;
      organizationId: string;
      branchId: string;
      userId: string;
      lines: { variantId: string; quantity: number }[];
    },
  ) {
    await assertVariantsBelongToOrg(
      params.organizationId,
      params.lines.map((l) => l.variantId),
    );

    const movementNumber = await generateDocumentNumber("STK-OUT", params.organizationId);

    const movement = await tx.inventoryMovement.create({
      data: {
        organizationId: params.organizationId,
        branchId: params.branchId,
        warehouseId: params.warehouseId,
        movementNumber,
        movementType: "RETURN_OUT",
        movementDate: new Date(),
        referenceType: "SupplierReturn",
        referenceId: params.returnId,
        status: "COMPLETED",
        createdById: params.userId,
      },
    });

    for (const line of params.lines) {
      await this.processLineOut(tx, {
        warehouseId: params.warehouseId,
        movementId: movement.id,
        movementType: "RETURN_OUT",
        referenceType: "SupplierReturn",
        referenceId: params.returnId,
        line: { variantId: line.variantId, quantity: line.quantity },
        organizationId: params.organizationId,
      });
    }

    return movement;
  }
}

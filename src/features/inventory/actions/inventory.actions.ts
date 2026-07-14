"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, authorizeSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getErrorMessage } from "@/lib/errors/app-error";
import { InventoryService } from "@/lib/services/inventory-service";
import { InventoryQueryService } from "@/features/inventory/services/inventory-query.service";

const lineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

const movementSchema = z.object({
  warehouseId: z.string().uuid(),
  movementDate: z.string(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

const transferSchema = z.object({
  sourceWarehouseId: z.string().uuid(),
  destWarehouseId: z.string().uuid(),
  movementDate: z.string(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

const adjustLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().positive(),
  direction: z.enum(["IN", "OUT"]),
  unitCost: z.number().nonnegative().optional(),
});

const adjustSchema = z.object({
  warehouseId: z.string().uuid(),
  movementDate: z.string(),
  reasonCode: z.string().min(1),
  notes: z.string().optional(),
  lines: z.array(adjustLineSchema).min(1),
});

function serviceContext(session: Awaited<ReturnType<typeof requireSession>>) {
  return {
    organizationId: session.user.organizationId,
    branchId: session.user.branchId,
    userId: session.user.id,
  };
}

export async function listStockLevelsAction(params: {
  warehouseId?: string;
  search?: string;
  lowStockOnly?: boolean;
  page?: number;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.INVENTORY.VIEW);
  const { branchId, ...rest } = params;
  return InventoryQueryService.listStockLevels({
    organizationId: session.user.organizationId,
    branchId: resolveSessionBranchFilter(session.user, branchId),
    ...rest,
  });
}

export async function getValuationAction(warehouseId?: string, branchId?: string) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.INVENTORY.VIEW);
  return InventoryQueryService.getValuation(
    session.user.organizationId,
    warehouseId,
    resolveSessionBranchFilter(session.user, branchId),
  );
}

export async function getLedgerAction(params: {
  warehouseId?: string;
  variantId?: string;
  from?: string;
  to?: string;
  page?: number;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.INVENTORY.LEDGER_VIEW);
  return InventoryQueryService.getLedger({
    organizationId: session.user.organizationId,
    branchId: resolveSessionBranchFilter(session.user, params.branchId),
    warehouseId: params.warehouseId,
    variantId: params.variantId,
    from: params.from ? new Date(params.from) : undefined,
    to: params.to ? new Date(params.to) : undefined,
    page: params.page,
  });
}

export async function listMovementsAction(params: {
  movementType?: string;
  warehouseId?: string;
  page?: number;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.INVENTORY.VIEW);
  return InventoryQueryService.listMovements({
    organizationId: session.user.organizationId,
    branchId: resolveSessionBranchFilter(session.user, params.branchId),
    warehouseId: params.warehouseId,
    page: params.page,
    ...(params.movementType ? { movementType: params.movementType as never } : {}),
  });
}

export async function searchVariantsAction(query: string) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.INVENTORY.VIEW);
  const variants = await InventoryQueryService.searchVariants(
    session.user.organizationId,
    query,
  );
  return variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    costPrice: Number(variant.costPrice),
    product: variant.product,
  }));
}

export async function stockInAction(input: z.infer<typeof movementSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.INVENTORY.STOCK_IN);
    const data = movementSchema.parse(input);
    const movement = await InventoryService.stockIn(
      { ...data, movementDate: new Date(data.movementDate) },
      serviceContext(session),
    );
    revalidatePath("/inventory");
    return { success: true, movement };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function stockOutAction(input: z.infer<typeof movementSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.INVENTORY.STOCK_OUT);
    const data = movementSchema.parse(input);
    const movement = await InventoryService.stockOut(
      { ...data, movementDate: new Date(data.movementDate) },
      serviceContext(session),
    );
    revalidatePath("/inventory");
    return { success: true, movement };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function adjustStockAction(input: z.infer<typeof adjustSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.INVENTORY.ADJUST);
    const data = adjustSchema.parse(input);
    const result = await InventoryService.adjust(
      { ...data, movementDate: new Date(data.movementDate) },
      serviceContext(session),
    );
    revalidatePath("/inventory");
    return { success: true, ...result };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function transferStockAction(input: z.infer<typeof transferSchema>) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.INVENTORY.TRANSFER);
    const data = transferSchema.parse(input);
    const result = await InventoryService.transfer(
      { ...data, movementDate: new Date(data.movementDate) },
      serviceContext(session),
    );
    revalidatePath("/inventory");
    return { success: true, ...result };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function initializeStockLevelsAction(warehouseId: string) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.INVENTORY.ADJUST);
    const result = await InventoryService.initializeStockLevels(
      warehouseId,
      session.user.organizationId,
      session.user.id,
      session.user.branchId,
    );
    revalidatePath("/inventory");
    return { success: true, ...result };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function createStockCountAction(input: {
  warehouseId: string;
  countDate: string;
  notes?: string;
}) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.INVENTORY.STOCK_COUNT);
    const stockCount = await InventoryService.createStockCount(
      { ...input, countDate: new Date(input.countDate) },
      serviceContext(session),
    );
    revalidatePath("/inventory/stock-count");
    return { success: true, stockCount };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function updateStockCountLinesAction(
  stockCountId: string,
  lines: { id: string; countedQty: number }[],
) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.INVENTORY.STOCK_COUNT);
    await InventoryService.updateStockCountLines(
      stockCountId,
      lines,
      session.user.organizationId,
    );
    revalidatePath("/inventory/stock-count");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function completeStockCountAction(stockCountId: string) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.INVENTORY.STOCK_COUNT);
    await InventoryService.completeStockCount(stockCountId, serviceContext(session));
    revalidatePath("/inventory");
    revalidatePath("/inventory/stock-count");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function listStockCountsAction(warehouseId?: string) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.INVENTORY.STOCK_COUNT);
  return InventoryQueryService.listStockCounts(session.user.organizationId, warehouseId);
}

export async function getStockCountAction(id: string) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.INVENTORY.STOCK_COUNT);
  return InventoryQueryService.getStockCount(id, session.user.organizationId);
}

export async function getInventorySummaryAction() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.INVENTORY.VIEW);
  return InventoryQueryService.getSummary(session.user.organizationId);
}

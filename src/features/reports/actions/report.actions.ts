"use server";

import { requireSession, authorizeSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ReportService, type ReportFilters } from "@/features/reports/services/report.service";

function parseFilters(
  session: Awaited<ReturnType<typeof requireSession>>,
  params: { from?: string; to?: string; branchId?: string; page?: number; pageSize?: number },
): ReportFilters {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  return {
    organizationId: session.user.organizationId,
    branchId: resolveSessionBranchFilter(session.user, params.branchId),
    from: new Date(params.from ?? monthStart),
    to: new Date(params.to ?? today),
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function getDailySalesReportAction(params: {
  from?: string;
  to?: string;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.SALES);
  return ReportService.getDailySales(parseFilters(session, params));
}

export async function getSalesByProductReportAction(params: {
  from?: string;
  to?: string;
  branchId?: string;
  page?: number;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.SALES);
  return ReportService.getSalesByProduct(parseFilters(session, params));
}

export async function getSalesByCategoryReportAction(params: {
  from?: string;
  to?: string;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.SALES);
  return ReportService.getSalesByCategory(parseFilters(session, params));
}

export async function getSalesByCashierReportAction(params: {
  from?: string;
  to?: string;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.SALES);
  return ReportService.getSalesByCashier(parseFilters(session, params));
}

export async function getSalesByPaymentReportAction(params: {
  from?: string;
  to?: string;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.SALES);
  return ReportService.getSalesByPaymentMethod(parseFilters(session, params));
}

export async function getPurchaseReportAction(params: {
  from?: string;
  to?: string;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.PURCHASES);
  return ReportService.getPurchaseSummary(parseFilters(session, params));
}

export async function getInventoryStockReportAction(params: {
  branchId?: string;
  warehouseId?: string;
  search?: string;
  page?: number;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.INVENTORY);
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return ReportService.getStockOnHand({
    organizationId: session.user.organizationId,
    branchId: resolveSessionBranchFilter(session.user, params.branchId),
    from: monthStart,
    to: today,
    warehouseId: params.warehouseId,
    search: params.search,
    page: params.page,
  });
}

export async function getInventoryValuationReportAction(params: {
  warehouseId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.INVENTORY);
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return ReportService.getInventoryValuation({
    organizationId: session.user.organizationId,
    from: monthStart,
    to: today,
    warehouseId: params.warehouseId,
  });
}

export async function getInventoryMovementReportAction(params: {
  from?: string;
  to?: string;
  warehouseId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.INVENTORY);
  return ReportService.getInventoryMovement({
    ...parseFilters(session, params),
    warehouseId: params.warehouseId,
  });
}

export async function getProfitReportAction(params: {
  from?: string;
  to?: string;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.FINANCIAL);
  return ReportService.getProfitByProduct(parseFilters(session, params));
}

export async function getBestSellingReportAction(params: {
  from?: string;
  to?: string;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.SALES);
  return ReportService.getBestSelling(parseFilters(session, params));
}

export async function getSlowMovingReportAction(params: {
  from?: string;
  to?: string;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.INVENTORY);
  return ReportService.getSlowMoving(parseFilters(session, params));
}

export async function getDeadStockReportAction(params: {
  from?: string;
  to?: string;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.INVENTORY);
  return ReportService.getDeadStock(parseFilters(session, params));
}

export async function getCustomerStatementReportAction(params: {
  customerId: string;
  from?: string;
  to?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.FINANCIAL);
  return ReportService.getCustomerStatement(
    params.customerId,
    parseFilters(session, params),
  );
}

export async function getSupplierStatementReportAction(params: {
  supplierId: string;
  from?: string;
  to?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.FINANCIAL);
  return ReportService.getSupplierStatement(
    params.supplierId,
    parseFilters(session, params),
  );
}

export async function getTaxReportAction(params: {
  from?: string;
  to?: string;
  branchId?: string;
}) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.REPORTS.FINANCIAL);
  return ReportService.getTaxReport(parseFilters(session, params));
}

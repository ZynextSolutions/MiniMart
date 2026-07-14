import { ForbiddenError } from "@/lib/errors/app-error";
import type { AuthSession } from "@/lib/auth/session";

export type BranchFilter = string | { in: string[] };

export const ALL_BRANCHES_PARAM = "all";

export function resolveAuthorizedBranchFilter(
  branchIds: string[],
  requestedBranchId?: string | null,
): BranchFilter {
  if (branchIds.length === 0) {
    throw new ForbiddenError("No branch access");
  }

  if (requestedBranchId && requestedBranchId !== ALL_BRANCHES_PARAM) {
    if (!branchIds.includes(requestedBranchId)) {
      throw new ForbiddenError("Branch access denied");
    }
    return requestedBranchId;
  }

  return { in: branchIds };
}

/** Require a single authorized branch UUID (rejects "all" / omitted). */
export function requireAuthorizedBranchId(
  branchIds: string[],
  branchId: string,
): string {
  const resolved = resolveAuthorizedBranchFilter(branchIds, branchId);
  if (typeof resolved !== "string") {
    throw new ForbiddenError("Branch access denied");
  }
  return resolved;
}

/**
 * Branch filter for lists/reports.
 * - omitted → active branch (fallback: all authorized)
 * - "all" → all authorized branches
 * - uuid → that branch (must be authorized)
 */
export function resolveSessionBranchFilter(
  session: Pick<AuthSession["user"], "branchIds" | "branchId">,
  requestedBranchId?: string | null,
): BranchFilter {
  if (requestedBranchId === ALL_BRANCHES_PARAM) {
    return resolveAuthorizedBranchFilter(session.branchIds, null);
  }

  if (requestedBranchId) {
    return resolveAuthorizedBranchFilter(session.branchIds, requestedBranchId);
  }

  if (session.branchId) {
    return resolveAuthorizedBranchFilter(session.branchIds, session.branchId);
  }

  return resolveAuthorizedBranchFilter(session.branchIds, null);
}

/** Prisma-friendly helper for optional branchId columns. */
export function prismaBranchWhere(branchId?: BranchFilter): { branchId?: BranchFilter } {
  if (!branchId) return {};
  return { branchId };
}

/** Prisma-friendly helper for warehouse.branchId scoping. */
export function prismaWarehouseBranchWhere(
  branchId?: BranchFilter,
): { warehouse?: { branchId: BranchFilter } } {
  if (!branchId) return {};
  return { warehouse: { branchId } };
}

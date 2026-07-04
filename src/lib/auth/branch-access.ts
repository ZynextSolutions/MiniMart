import { ForbiddenError } from "@/lib/errors/app-error";
import type { AuthSession } from "@/lib/auth/session";

export type BranchFilter = string | { in: string[] };

export function resolveAuthorizedBranchFilter(
  branchIds: string[],
  requestedBranchId?: string | null,
): BranchFilter {
  if (branchIds.length === 0) {
    throw new ForbiddenError("No branch access");
  }

  if (requestedBranchId) {
    if (!branchIds.includes(requestedBranchId)) {
      throw new ForbiddenError("Branch access denied");
    }
    return requestedBranchId;
  }

  return { in: branchIds };
}

export function resolveSessionBranchFilter(
  session: Pick<AuthSession["user"], "branchIds" | "branchId">,
  requestedBranchId?: string | null,
): BranchFilter {
  return resolveAuthorizedBranchFilter(
    session.branchIds,
    requestedBranchId ?? session.branchId,
  );
}

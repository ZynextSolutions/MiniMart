"use server";

import { auth } from "@/lib/auth/auth";
import { getUserBranches, getUserPermissions } from "@/lib/permissions/authorization";
import { UnauthorizedError } from "@/lib/errors/app-error";

export async function switchBranchAction(branchId: string) {
  const session = await auth();
  if (!session?.user?.id || session.error) throw new UnauthorizedError();

  const branches = await getUserBranches(session.user.id);
  if (!branches.some((branch) => branch.id === branchId)) {
    throw new UnauthorizedError("Branch access denied");
  }

  const permissions = await getUserPermissions(session.user.id, branchId);

  return {
    success: true,
    branchId,
    permissions: Array.from(permissions),
  };
}

import { prisma } from "@/infrastructure/database/prisma";
import { ForbiddenError } from "@/lib/errors/app-error";
import type { Permission } from "./permissions";
import { ALL_PERMISSION_CODES } from "./permissions";
import { SYSTEM_ROLES } from "./roles";

export async function getUserPermissions(
  userId: string,
  branchId?: string,
): Promise<Set<string>> {
  const assignments = await prisma.userBranchRole.findMany({
    where: {
      userId,
      ...(branchId ? { branchId } : {}),
      user: { isActive: true, deletedAt: null },
      branch: { isActive: true, deletedAt: null },
      role: { deletedAt: null },
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  const permissions = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.role.name === SYSTEM_ROLES.OWNER) {
      for (const code of ALL_PERMISSION_CODES) permissions.add(code);
      continue;
    }
    for (const rp of assignment.role.rolePermissions) {
      permissions.add(rp.permission.code);
    }
  }
  return permissions;
}

export async function can(
  userId: string,
  permission: Permission | string,
  context?: { branchId?: string },
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, context?.branchId);
  return permissions.has(permission);
}

export async function authorize(
  userId: string,
  permission: Permission | string,
  context?: { branchId?: string },
): Promise<void> {
  const allowed = await can(userId, permission, context);
  if (!allowed) {
    throw new ForbiddenError(permission);
  }
}

export async function getUserBranches(userId: string) {
  return prisma.branch.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      userBranchRoles: { some: { userId } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

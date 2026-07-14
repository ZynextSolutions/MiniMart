import { prisma } from "@/infrastructure/database/prisma";
import { ForbiddenError } from "@/lib/errors/app-error";
import type { Permission } from "./permissions";
import { ALL_PERMISSION_CODES } from "./permissions";

async function getActiveUserOrganizationId(userId: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

export async function isOrganizationOwner(
  userId: string,
  organizationId?: string,
): Promise<boolean> {
  const resolvedOrganizationId =
    organizationId ?? (await getActiveUserOrganizationId(userId));
  if (!resolvedOrganizationId) return false;

  const organization = await prisma.organization.findFirst({
    where: { id: resolvedOrganizationId, deletedAt: null },
    select: { ownerUserId: true },
  });
  if (!organization) return false;
  return organization.ownerUserId === userId;
}

export async function getUserPermissions(
  userId: string,
  branchId?: string,
): Promise<Set<string>> {
  const organizationId = await getActiveUserOrganizationId(userId);
  if (!organizationId) {
    return new Set<string>();
  }

  if (await isOrganizationOwner(userId, organizationId)) {
    return new Set<string>(ALL_PERMISSION_CODES);
  }

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
  const organizationId = await getActiveUserOrganizationId(userId);
  if (!organizationId) return [];

  if (await isOrganizationOwner(userId, organizationId)) {
    return prisma.branch.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  return prisma.branch.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      userBranchRoles: { some: { userId } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

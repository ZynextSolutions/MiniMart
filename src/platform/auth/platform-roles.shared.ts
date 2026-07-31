import type { PlatformUserRole } from "@prisma/client";

export const PLATFORM_ROLES = {
  ALL: ["SUPER_ADMIN", "SUPPORT", "BILLING"] as PlatformUserRole[],
  ADMIN: ["SUPER_ADMIN"] as PlatformUserRole[],
  OPS: ["SUPER_ADMIN", "SUPPORT"] as PlatformUserRole[],
  BILLING: ["SUPER_ADMIN", "BILLING"] as PlatformUserRole[],
};

/** Role requirements for platform pages — keep in sync with sidebar nav. */
export const PLATFORM_PAGE_ROLES = {
  dashboard: PLATFORM_ROLES.ALL,
  organizations: PLATFORM_ROLES.ALL,
  plans: PLATFORM_ROLES.BILLING,
  subscriptions: PLATFORM_ROLES.BILLING,
  users: PLATFORM_ROLES.ADMIN,
  support: PLATFORM_ROLES.ALL,
  announcements: PLATFORM_ROLES.OPS,
  featureFlags: PLATFORM_ROLES.ADMIN,
  auditLogs: PLATFORM_ROLES.ALL,
  monitoring: PLATFORM_ROLES.ALL,
} as const;

export function platformRoleCanAccess(
  role: string,
  allowed: PlatformUserRole[],
): boolean {
  return allowed.includes(role as PlatformUserRole);
}

/** True when an update would leave the platform with zero active SUPER_ADMINs. */
export function wouldRemoveLastSuperAdmin(
  user: { role: PlatformUserRole; isActive: boolean },
  updates: { role?: PlatformUserRole; isActive?: boolean },
  activeSuperAdminCount: number,
): boolean {
  if (user.role !== "SUPER_ADMIN" || !user.isActive) return false;
  if (activeSuperAdminCount > 1) return false;
  const nextRole = updates.role ?? user.role;
  const nextActive = updates.isActive ?? user.isActive;
  return nextRole !== "SUPER_ADMIN" || !nextActive;
}

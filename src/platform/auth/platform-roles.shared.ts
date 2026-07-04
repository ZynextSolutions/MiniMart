import type { PlatformUserRole } from "@prisma/client";

export const PLATFORM_ROLES = {
  ALL: ["SUPER_ADMIN", "SUPPORT", "BILLING"] as PlatformUserRole[],
  ADMIN: ["SUPER_ADMIN"] as PlatformUserRole[],
  OPS: ["SUPER_ADMIN", "SUPPORT"] as PlatformUserRole[],
  BILLING: ["SUPER_ADMIN", "BILLING"] as PlatformUserRole[],
};

export function platformRoleCanAccess(
  role: string,
  allowed: PlatformUserRole[],
): boolean {
  return allowed.includes(role as PlatformUserRole);
}

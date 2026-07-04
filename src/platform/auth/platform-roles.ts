import type { PlatformUserRole } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors/app-error";
import {
  requirePlatformSession,
  type PlatformSession,
} from "@/platform/auth/platform-session";

export { PLATFORM_ROLES, platformRoleCanAccess } from "@/platform/auth/platform-roles.shared";

export async function requirePlatformRole(
  ...roles: PlatformUserRole[]
): Promise<PlatformSession> {
  const session = await requirePlatformSession();
  const role = session.user.platformRole as PlatformUserRole;
  if (!roles.includes(role)) {
    throw new ForbiddenError("Insufficient platform privileges");
  }
  return session;
}

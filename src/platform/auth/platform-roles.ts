import type { PlatformUserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors/app-error";
import {
  requirePlatformSession,
  type PlatformSession,
} from "@/platform/auth/platform-session";

export {
  PLATFORM_PAGE_ROLES,
  PLATFORM_ROLES,
  platformRoleCanAccess,
  wouldRemoveLastSuperAdmin,
} from "@/platform/auth/platform-roles.shared";

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

/** Page-level gate: redirects instead of throwing (for RSC pages). */
export async function requirePlatformPageAccess(
  ...roles: PlatformUserRole[]
): Promise<PlatformSession> {
  try {
    return await requirePlatformRole(...roles);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/platform-login");
    }
    if (error instanceof ForbiddenError) {
      redirect("/platform");
    }
    throw error;
  }
}

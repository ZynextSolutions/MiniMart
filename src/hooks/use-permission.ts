"use client";

import { useSession } from "next-auth/react";

export function usePermission() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];

  return {
    permissions,
    hasPermission: (permission: string) => permissions.includes(permission),
    hasAnyPermission: (perms: string[]) =>
      perms.some((p) => permissions.includes(p)),
    hasAllPermissions: (perms: string[]) =>
      perms.every((p) => permissions.includes(p)),
  };
}

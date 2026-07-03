import { PERMISSIONS } from "@/lib/permissions/permissions";

const LANDING_CANDIDATES: { permission: string; path: string }[] = [
  { permission: PERMISSIONS.REPORTS.DASHBOARD, path: "/" },
  { permission: PERMISSIONS.POS.ACCESS, path: "/pos" },
  { permission: PERMISSIONS.CASH_REGISTER.VIEW, path: "/cash-register" },
  { permission: PERMISSIONS.PRODUCTS.VIEW, path: "/products" },
  { permission: PERMISSIONS.INVENTORY.VIEW, path: "/inventory" },
  { permission: PERMISSIONS.ACCOUNTING.JOURNAL_VIEW, path: "/accounting/journal" },
  { permission: PERMISSIONS.REPORTS.SALES, path: "/reports/sales" },
  { permission: PERMISSIONS.SETTINGS.COMPANY_VIEW, path: "/settings/company" },
];

export function resolveLandingPath(
  permissions: string[] | undefined,
  preferredPath = "/",
): string | null {
  const allowed = new Set(permissions ?? []);

  if (preferredPath !== "/" && canAccessPath(allowed, preferredPath)) {
    return preferredPath;
  }

  for (const candidate of LANDING_CANDIDATES) {
    if (allowed.has(candidate.permission)) {
      return candidate.path;
    }
  }

  return null;
}

function canAccessPath(allowed: Set<string>, path: string): boolean {
  const match = LANDING_CANDIDATES.find((c) => c.path === path);
  if (!match) return path === "/";
  return allowed.has(match.permission);
}

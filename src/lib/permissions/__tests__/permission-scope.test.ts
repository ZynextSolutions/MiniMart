import { describe, expect, it } from "vitest";
import {
  isOrgScopedPermission,
  PERMISSIONS,
} from "@/lib/permissions/permissions";

describe("permission scope", () => {
  it("marks admin master-data permissions as organization-scoped", () => {
    expect(isOrgScopedPermission(PERMISSIONS.USERS.VIEW)).toBe(true);
    expect(isOrgScopedPermission(PERMISSIONS.ROLES.MANAGE)).toBe(true);
    expect(isOrgScopedPermission(PERMISSIONS.SETTINGS.COMPANY_UPDATE)).toBe(
      true,
    );
    expect(isOrgScopedPermission(PERMISSIONS.SETTINGS.BRANCH_MANAGE)).toBe(true);
  });

  it("marks operational permissions as branch-scoped", () => {
    expect(isOrgScopedPermission(PERMISSIONS.POS.ACCESS)).toBe(false);
    expect(isOrgScopedPermission(PERMISSIONS.INVENTORY.VIEW)).toBe(false);
    expect(isOrgScopedPermission(PERMISSIONS.PRODUCTS.VIEW)).toBe(false);
    expect(isOrgScopedPermission(PERMISSIONS.REPORTS.SALES)).toBe(false);
    expect(isOrgScopedPermission(PERMISSIONS.SETTINGS.WAREHOUSE_MANAGE)).toBe(
      false,
    );
  });
});

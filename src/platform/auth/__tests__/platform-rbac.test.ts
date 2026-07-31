import { describe, expect, it } from "vitest";
import {
  platformRoleCanAccess,
  PLATFORM_PAGE_ROLES,
  PLATFORM_ROLES,
  wouldRemoveLastSuperAdmin,
} from "@/platform/auth/platform-roles.shared";

describe("platformRoleCanAccess", () => {
  it("allows SUPER_ADMIN for admin-only routes", () => {
    expect(platformRoleCanAccess("SUPER_ADMIN", PLATFORM_ROLES.ADMIN)).toBe(true);
  });

  it("denies SUPPORT for admin-only routes", () => {
    expect(platformRoleCanAccess("SUPPORT", PLATFORM_ROLES.ADMIN)).toBe(false);
  });

  it("allows BILLING for billing routes", () => {
    expect(platformRoleCanAccess("BILLING", PLATFORM_ROLES.BILLING)).toBe(true);
  });

  it("denies BILLING for ops routes", () => {
    expect(platformRoleCanAccess("BILLING", PLATFORM_ROLES.OPS)).toBe(false);
  });
});

describe("PLATFORM_PAGE_ROLES", () => {
  it("keeps users and feature flags admin-only", () => {
    expect(PLATFORM_PAGE_ROLES.users).toEqual(PLATFORM_ROLES.ADMIN);
    expect(PLATFORM_PAGE_ROLES.featureFlags).toEqual(PLATFORM_ROLES.ADMIN);
  });

  it("keeps plans and subscriptions billing-scoped", () => {
    expect(PLATFORM_PAGE_ROLES.plans).toEqual(PLATFORM_ROLES.BILLING);
    expect(PLATFORM_PAGE_ROLES.subscriptions).toEqual(PLATFORM_ROLES.BILLING);
  });
});

describe("wouldRemoveLastSuperAdmin", () => {
  const lastAdmin = { role: "SUPER_ADMIN" as const, isActive: true };

  it("blocks demoting the last active super admin", () => {
    expect(
      wouldRemoveLastSuperAdmin(lastAdmin, { role: "SUPPORT" }, 1),
    ).toBe(true);
  });

  it("blocks deactivating the last active super admin", () => {
    expect(
      wouldRemoveLastSuperAdmin(lastAdmin, { isActive: false }, 1),
    ).toBe(true);
  });

  it("allows demotion when another super admin remains", () => {
    expect(
      wouldRemoveLastSuperAdmin(lastAdmin, { role: "BILLING" }, 2),
    ).toBe(false);
  });

  it("ignores non-admin users", () => {
    expect(
      wouldRemoveLastSuperAdmin(
        { role: "SUPPORT", isActive: true },
        { isActive: false },
        1,
      ),
    ).toBe(false);
  });
});

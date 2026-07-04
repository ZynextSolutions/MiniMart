import { describe, expect, it } from "vitest";
import {
  platformRoleCanAccess,
  PLATFORM_ROLES,
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

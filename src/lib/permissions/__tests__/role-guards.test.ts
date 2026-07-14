import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors/app-error";
import {
  assertRoleAssignable,
  assertSystemRoleRenameAllowed,
} from "@/lib/permissions/role-guards";
import { SYSTEM_ROLES } from "@/lib/permissions/roles";

describe("role guards", () => {
  it("blocks Owner role assignment", () => {
    expect(() => assertRoleAssignable(SYSTEM_ROLES.OWNER)).toThrow(ValidationError);
  });

  it("allows non-system role assignment", () => {
    expect(() => assertRoleAssignable(SYSTEM_ROLES.CASHIER)).not.toThrow();
  });

  it("blocks renaming system roles", () => {
    expect(() =>
      assertSystemRoleRenameAllowed(true, SYSTEM_ROLES.MANAGER, "Ops Lead"),
    ).toThrow(ValidationError);
  });

  it("allows keeping the same system role name", () => {
    expect(() =>
      assertSystemRoleRenameAllowed(true, SYSTEM_ROLES.MANAGER, SYSTEM_ROLES.MANAGER),
    ).not.toThrow();
  });

  it("allows renaming custom roles", () => {
    expect(() =>
      assertSystemRoleRenameAllowed(false, "Custom", "Custom 2"),
    ).not.toThrow();
  });
});

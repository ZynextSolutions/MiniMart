import { describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "@/lib/errors/app-error";
import {
  assertRoleAssignable,
  assertSystemRolePermissionsEditable,
} from "@/lib/permissions/role-guards";
import { SYSTEM_ROLES } from "@/lib/permissions/roles";

describe("role guards", () => {
  it("blocks Owner role assignment", () => {
    expect(() => assertRoleAssignable(SYSTEM_ROLES.OWNER)).toThrow(ValidationError);
  });

  it("allows non-system role assignment", () => {
    expect(() => assertRoleAssignable(SYSTEM_ROLES.CASHIER)).not.toThrow();
  });

  it("blocks system role permission edits", () => {
    expect(() => assertSystemRolePermissionsEditable(true, ["perm-1"])).toThrow(
      ConflictError,
    );
  });

  it("allows custom role permission edits", () => {
    expect(() => assertSystemRolePermissionsEditable(false, ["perm-1"])).not.toThrow();
  });
});

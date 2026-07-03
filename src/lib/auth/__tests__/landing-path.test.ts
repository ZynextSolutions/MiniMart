import { describe, expect, it } from "vitest";
import { resolveLandingPath } from "@/lib/auth/landing-path";
import { PERMISSIONS } from "@/lib/permissions/permissions";

describe("resolveLandingPath", () => {
  it("sends cashiers to POS instead of dashboard", () => {
    const path = resolveLandingPath([
      PERMISSIONS.POS.ACCESS,
      PERMISSIONS.PRODUCTS.VIEW,
    ]);
    expect(path).toBe("/pos");
  });

  it("keeps dashboard for users with dashboard permission", () => {
    const path = resolveLandingPath([PERMISSIONS.REPORTS.DASHBOARD]);
    expect(path).toBe("/");
  });

  it("honours an accessible callback path", () => {
    const path = resolveLandingPath([PERMISSIONS.POS.ACCESS], "/pos");
    expect(path).toBe("/pos");
  });

  it("returns null when user has no known landing permission", () => {
    expect(resolveLandingPath([])).toBeNull();
  });
});

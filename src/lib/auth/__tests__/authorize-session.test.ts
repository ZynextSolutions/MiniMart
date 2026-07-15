import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeMock } = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
}));

vi.mock("@/lib/permissions/authorization", () => ({
  authorize: authorizeMock,
}));

vi.mock("@/platform/tenant/tenant-prisma", () => ({
  getPrismaBase: vi.fn(),
  getPrisma: vi.fn(() => ({})),
}));

vi.mock("@/platform/tenant/tenant-context", () => ({
  withOrganizationContext: (_orgId: string, fn: () => Promise<unknown>) => fn(),
}));

vi.mock("@/platform/subscriptions/subscription-guard.service", () => ({
  SubscriptionGuardService: {
    assertOrganizationAccess: vi.fn(),
  },
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
}));

import { authorizeSession } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors/app-error";
import { PERMISSIONS } from "@/lib/permissions/permissions";

describe("authorizeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeMock.mockResolvedValue(undefined);
  });

  it("checks org-scoped permissions without branchId", async () => {
    await authorizeSession(
      { user: { id: "u1", branchId: null } },
      PERMISSIONS.USERS.VIEW,
    );

    expect(authorizeMock).toHaveBeenCalledWith("u1", PERMISSIONS.USERS.VIEW);
  });

  it("requires an active branch for operational permissions", async () => {
    await expect(
      authorizeSession(
        { user: { id: "u1", branchId: null } },
        PERMISSIONS.INVENTORY.VIEW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(authorizeMock).not.toHaveBeenCalled();
  });

  it("passes active branchId for operational permissions", async () => {
    await authorizeSession(
      { user: { id: "u1", branchId: "b1" } },
      PERMISSIONS.POS.ACCESS,
    );

    expect(authorizeMock).toHaveBeenCalledWith("u1", PERMISSIONS.POS.ACCESS, {
      branchId: "b1",
    });
  });

  it("allows forcing organization scope", async () => {
    await authorizeSession(
      { user: { id: "u1", branchId: "b1" } },
      PERMISSIONS.INVENTORY.VIEW,
      { scope: "organization" },
    );

    expect(authorizeMock).toHaveBeenCalledWith("u1", PERMISSIONS.INVENTORY.VIEW);
  });
});

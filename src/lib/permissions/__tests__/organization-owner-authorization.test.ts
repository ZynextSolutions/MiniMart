import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findFirst: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
    },
    userBranchRole: {
      findMany: vi.fn(),
    },
    branch: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: prismaMock,
}));

import {
  can,
  getUserBranches,
  getUserPermissions,
  isOrganizationOwner,
} from "@/lib/permissions/authorization";
import { ALL_PERMISSION_CODES, PERMISSIONS } from "@/lib/permissions/permissions";

const ORG_ID = "org-1";
const OWNER_ID = "owner-1";
const MEMBER_ID = "member-1";

describe("organization owner authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isOrganizationOwner", () => {
    it("returns true when user matches organization ownerUserId", async () => {
      prismaMock.organization.findFirst.mockResolvedValue({ ownerUserId: OWNER_ID });

      await expect(isOrganizationOwner(OWNER_ID, ORG_ID)).resolves.toBe(true);
      expect(prismaMock.organization.findFirst).toHaveBeenCalledWith({
        where: { id: ORG_ID, deletedAt: null },
        select: { ownerUserId: true },
      });
    });

    it("returns false when user is not the organization owner", async () => {
      prismaMock.organization.findFirst.mockResolvedValue({ ownerUserId: OWNER_ID });

      await expect(isOrganizationOwner(MEMBER_ID, ORG_ID)).resolves.toBe(false);
    });

    it("returns false when organization has no owner", async () => {
      prismaMock.organization.findFirst.mockResolvedValue({ ownerUserId: null });

      await expect(isOrganizationOwner(OWNER_ID, ORG_ID)).resolves.toBe(false);
    });

    it("resolves organization from active user when organizationId is omitted", async () => {
      prismaMock.user.findFirst.mockResolvedValue({ organizationId: ORG_ID });
      prismaMock.organization.findFirst.mockResolvedValue({ ownerUserId: OWNER_ID });

      await expect(isOrganizationOwner(OWNER_ID)).resolves.toBe(true);
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { id: OWNER_ID, isActive: true, deletedAt: null },
        select: { organizationId: true },
      });
    });

    it("returns false when user is inactive or missing", async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(isOrganizationOwner(OWNER_ID)).resolves.toBe(false);
      expect(prismaMock.organization.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("getUserPermissions", () => {
    it("grants all permissions to the organization owner without role lookups", async () => {
      prismaMock.user.findFirst.mockResolvedValue({ organizationId: ORG_ID });
      prismaMock.organization.findFirst.mockResolvedValue({ ownerUserId: OWNER_ID });

      const permissions = await getUserPermissions(OWNER_ID);

      expect(permissions).toEqual(new Set(ALL_PERMISSION_CODES));
      expect(prismaMock.userBranchRole.findMany).not.toHaveBeenCalled();
    });

    it("falls back to role permissions for non-owners", async () => {
      prismaMock.user.findFirst.mockResolvedValue({ organizationId: ORG_ID });
      prismaMock.organization.findFirst.mockResolvedValue({ ownerUserId: OWNER_ID });
      prismaMock.userBranchRole.findMany.mockResolvedValue([
        {
          role: {
            rolePermissions: [
              { permission: { code: PERMISSIONS.POS.SALE_CREATE } },
              { permission: { code: PERMISSIONS.USERS.VIEW } },
            ],
          },
        },
      ]);

      const permissions = await getUserPermissions(MEMBER_ID, "branch-1");

      expect(permissions).toEqual(
        new Set([PERMISSIONS.POS.SALE_CREATE, PERMISSIONS.USERS.VIEW]),
      );
      expect(prismaMock.userBranchRole.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: MEMBER_ID,
            branchId: "branch-1",
          }),
        }),
      );
    });
  });

  describe("can / getUserBranches", () => {
    it("allows any permission for the organization owner", async () => {
      prismaMock.user.findFirst.mockResolvedValue({ organizationId: ORG_ID });
      prismaMock.organization.findFirst.mockResolvedValue({ ownerUserId: OWNER_ID });

      await expect(can(OWNER_ID, PERMISSIONS.ROLES.MANAGE)).resolves.toBe(true);
    });

    it("returns all active organization branches for the owner", async () => {
      const branches = [
        { id: "b1", name: "HQ", isDefault: true },
        { id: "b2", name: "Outlet", isDefault: false },
      ];
      prismaMock.user.findFirst.mockResolvedValue({ organizationId: ORG_ID });
      prismaMock.organization.findFirst.mockResolvedValue({ ownerUserId: OWNER_ID });
      prismaMock.branch.findMany.mockResolvedValue(branches);

      await expect(getUserBranches(OWNER_ID)).resolves.toEqual(branches);
      expect(prismaMock.branch.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: ORG_ID,
          deletedAt: null,
          isActive: true,
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
    });

    it("returns only assigned branches for non-owners", async () => {
      const branches = [{ id: "b1", name: "HQ", isDefault: true }];
      prismaMock.user.findFirst.mockResolvedValue({ organizationId: ORG_ID });
      prismaMock.organization.findFirst.mockResolvedValue({ ownerUserId: OWNER_ID });
      prismaMock.branch.findMany.mockResolvedValue(branches);

      await expect(getUserBranches(MEMBER_ID)).resolves.toEqual(branches);
      expect(prismaMock.branch.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          isActive: true,
          userBranchRoles: { some: { userId: MEMBER_ID } },
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
    });
  });
});

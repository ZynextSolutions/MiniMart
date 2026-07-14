import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError } from "@/lib/errors/app-error";
import { can, isOrganizationOwner } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SYSTEM_ROLES } from "@/lib/permissions/roles";
import {
  SEED_IDS,
  assertSeededDatabase,
} from "@/lib/services/__tests__/helpers/sale-fixture";
import { UserService } from "@/features/users/services/user.service";

const INTEGRATION = process.env.INTEGRATION_TEST === "true";

async function integrationReady() {
  if (!INTEGRATION) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    await assertSeededDatabase();
    return true;
  } catch {
    return false;
  }
}

async function getSeedUserId(email: string) {
  const user = await prisma.user.findFirst({
    where: {
      organizationId: SEED_IDS.orgId,
      email,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!user) throw new Error(`Seed user not found: ${email}`);
  return user.id;
}

async function getOrganizationOwnerId() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: SEED_IDS.orgId },
    select: { ownerUserId: true },
  });
  return org.ownerUserId;
}

async function restoreSeedOwner(adminUserId: string) {
  const currentOwnerId = await getOrganizationOwnerId();
  if (currentOwnerId === adminUserId) return;

  if (currentOwnerId) {
    await UserService.transferOwnership(
      SEED_IDS.orgId,
      currentOwnerId,
      adminUserId,
    );
  } else {
    await prisma.organization.update({
      where: { id: SEED_IDS.orgId },
      data: { ownerUserId: adminUserId },
    });
  }
}

const ready = await integrationReady();

describe.runIf(ready)("organization ownership (integration)", () => {
  let adminUserId: string;
  let managerUserId: string;

  beforeAll(async () => {
    adminUserId = await getSeedUserId(SEED_IDS.adminEmail);
    managerUserId = await getSeedUserId(SEED_IDS.managerEmail);
    await restoreSeedOwner(adminUserId);
  });

  afterAll(async () => {
    try {
      await restoreSeedOwner(adminUserId);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("seeds admin as organization owner with full permissions", async () => {
    await expect(getOrganizationOwnerId()).resolves.toBe(adminUserId);
    await expect(isOrganizationOwner(adminUserId, SEED_IDS.orgId)).resolves.toBe(
      true,
    );
    await expect(can(adminUserId, PERMISSIONS.ROLES.MANAGE)).resolves.toBe(true);
  });

  it("blocks deleting the organization owner", async () => {
    await expect(
      UserService.softDelete(adminUserId, SEED_IDS.orgId, adminUserId),
    ).rejects.toBeInstanceOf(ConflictError);

    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: adminUserId },
      select: { deletedAt: true, isActive: true },
    });
    expect(owner.deletedAt).toBeNull();
    expect(owner.isActive).toBe(true);
  });

  it("blocks deactivating the organization owner", async () => {
    await expect(
      UserService.update(
        adminUserId,
        SEED_IDS.orgId,
        { isActive: false },
        adminUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: adminUserId },
      select: { isActive: true },
    });
    expect(owner.isActive).toBe(true);
  });

  it("blocks ownership transfer by a non-owner", async () => {
    await expect(
      UserService.transferOwnership(SEED_IDS.orgId, managerUserId, adminUserId),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("transfers ownership and demotes the previous owner", async () => {
    try {
      await UserService.transferOwnership(
        SEED_IDS.orgId,
        adminUserId,
        managerUserId,
      );

      await expect(getOrganizationOwnerId()).resolves.toBe(managerUserId);
      await expect(
        isOrganizationOwner(managerUserId, SEED_IDS.orgId),
      ).resolves.toBe(true);
      await expect(isOrganizationOwner(adminUserId, SEED_IDS.orgId)).resolves.toBe(
        false,
      );
      await expect(can(managerUserId, PERMISSIONS.ROLES.MANAGE)).resolves.toBe(
        true,
      );

      const ownerRole = await prisma.role.findFirstOrThrow({
        where: {
          organizationId: SEED_IDS.orgId,
          name: SYSTEM_ROLES.OWNER,
          deletedAt: null,
        },
        select: { id: true },
      });
      const previousOwnerStillHasOwnerRole = await prisma.userBranchRole.count({
        where: { userId: adminUserId, roleId: ownerRole.id },
      });
      expect(previousOwnerStillHasOwnerRole).toBe(0);

      const previousOwnerAssignments = await prisma.userBranchRole.count({
        where: { userId: adminUserId },
      });
      expect(previousOwnerAssignments).toBeGreaterThan(0);
    } finally {
      await restoreSeedOwner(adminUserId);
    }
  });

  it("rejects transferring ownership to the current owner", async () => {
    await expect(
      UserService.transferOwnership(SEED_IDS.orgId, adminUserId, adminUserId),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

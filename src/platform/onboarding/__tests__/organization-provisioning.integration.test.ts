import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { AccountMappingService } from "@/lib/services/account-mapping-service";
import {
  ACCOUNT_MAPPING_SETTING_KEY,
  DEFAULT_ACCOUNT_MAPPING,
  parseAccountMapping,
} from "@/platform/onboarding/default-account-mapping";
import { OrganizationProvisioningService } from "@/platform/onboarding/organization-provisioning.service";

const INTEGRATION = process.env.INTEGRATION_TEST === "true";

async function integrationReady() {
  if (!INTEGRATION) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    const plan = await prisma.plan.findFirst({
      where: { slug: "starter", isActive: true },
    });
    return Boolean(plan);
  } catch {
    return false;
  }
}

async function deleteProvisionedOrganization(organizationId: string) {
  await prisma.subscriptionEvent.deleteMany({
    where: { subscription: { organizationId } },
  });
  await prisma.subscription.deleteMany({ where: { organizationId } });
  await prisma.setting.deleteMany({ where: { organizationId } });
  await prisma.taxRate.deleteMany({ where: { organizationId } });
  await prisma.accountingPeriod.deleteMany({
    where: { fiscalYear: { organizationId } },
  });
  await prisma.fiscalYear.deleteMany({ where: { organizationId } });
  await prisma.account.deleteMany({ where: { organizationId } });
  await prisma.userBranchRole.deleteMany({
    where: { user: { organizationId } },
  });
  await prisma.user.deleteMany({ where: { organizationId } });
  await prisma.rolePermission.deleteMany({
    where: { role: { organizationId } },
  });
  await prisma.role.deleteMany({ where: { organizationId } });
  await prisma.cashRegister.deleteMany({
    where: { branch: { organizationId } },
  });
  await prisma.warehouse.deleteMany({ where: { organizationId } });
  await prisma.branch.deleteMany({ where: { organizationId } });
  await prisma.platformAuditLog.deleteMany({ where: { organizationId } });
  await prisma.organization.delete({ where: { id: organizationId } });
}

const ready = await integrationReady();

describe.runIf(ready)("OrganizationProvisioningService account mapping (integration)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates default account_mapping during provision", async () => {
    const slug = `map-test-${Date.now()}`;
    const email = `map-test-${Date.now()}@test.local`;

    const result = await OrganizationProvisioningService.provision({
      name: "Mapping Test Org",
      slug,
      ownerEmail: email,
      ownerPassword: "TestPassword123!",
      ownerFirstName: "Map",
      ownerLastName: "Tester",
      planSlug: "starter",
    });

    try {
      const setting = await prisma.setting.findUnique({
        where: {
          organizationId_key: {
            organizationId: result.org.id,
            key: ACCOUNT_MAPPING_SETTING_KEY,
          },
        },
      });

      expect(setting).toBeTruthy();
      expect(parseAccountMapping(setting?.value)).toEqual(DEFAULT_ACCOUNT_MAPPING);
      await AccountMappingService.validateAccountMapping(
        result.org.id,
        DEFAULT_ACCOUNT_MAPPING,
      );
    } finally {
      await deleteProvisionedOrganization(result.org.id);
    }
  });

  it("sets organization ownerUserId to the provisioned owner", async () => {
    const slug = `owner-test-${Date.now()}`;
    const email = `owner-test-${Date.now()}@test.local`;

    const result = await OrganizationProvisioningService.provision({
      name: "Owner Test Org",
      slug,
      ownerEmail: email,
      ownerPassword: "TestPassword123!",
      ownerFirstName: "Owner",
      ownerLastName: "Tester",
      planSlug: "starter",
    });

    try {
      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: result.org.id },
        select: { ownerUserId: true },
      });

      expect(organization.ownerUserId).toBe(result.owner.id);
      expect(result.owner.email).toBe(email);
    } finally {
      await deleteProvisionedOrganization(result.org.id);
    }
  });
});

describe.runIf(ready)("AccountMappingService lazy init (integration)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates default mapping when missing", async () => {
    const org = await prisma.organization.create({
      data: {
        name: "Lazy Mapping Org",
        slug: `lazy-map-${Date.now()}`,
        email: `lazy-map-${Date.now()}@test.local`,
        status: "TRIAL",
      },
    });

    try {
      const mapping = await AccountMappingService.getAccountMapping(org.id);
      expect(mapping).toEqual(DEFAULT_ACCOUNT_MAPPING);

      const setting = await prisma.setting.findUnique({
        where: {
          organizationId_key: {
            organizationId: org.id,
            key: ACCOUNT_MAPPING_SETTING_KEY,
          },
        },
      });
      expect(setting).toBeTruthy();
    } finally {
      await prisma.setting.deleteMany({ where: { organizationId: org.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    }
  });
});

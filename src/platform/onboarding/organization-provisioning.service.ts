import bcrypt from "bcryptjs";
import { getPrismaBase } from "@/platform/tenant/tenant-prisma";
import {
  ACCOUNT_MAPPING_SETTING_KEY,
  DEFAULT_ACCOUNT_MAPPING,
} from "./default-account-mapping";
import { DEFAULT_CHART_OF_ACCOUNTS } from "./default-chart-of-accounts";
import { PERMISSION_DEFINITIONS } from "@/lib/permissions/permissions";
import { ConflictError } from "@/lib/errors/app-error";
import { RoleService } from "@/features/roles/services/role.service";
import { slugify } from "./slug";

export type ProvisionOrganizationInput = {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerFirstName: string;
  ownerLastName: string;
  planSlug?: string;
  country?: string;
  currency?: string;
  timezone?: string;
};

export class OrganizationProvisioningService {
  static slugify = slugify;

  static async provision(input: ProvisionOrganizationInput) {
    const prisma = getPrismaBase();
    const slug = slugify(input.slug || input.name);

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictError("Organization slug already taken");
    }

    const email = input.ownerEmail.toLowerCase();
    const plan = await prisma.plan.findFirst({
      where: { slug: input.planSlug ?? "starter", isActive: true },
    });
    if (!plan) {
      throw new ConflictError("Selected plan is not available");
    }

    const passwordHash = await bcrypt.hash(input.ownerPassword, 12);
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + plan.trialDays);

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.name,
          slug,
          email: email,
          country: input.country ?? "MM",
          currency: input.currency ?? "MMK",
          timezone: input.timezone ?? "Asia/Yangon",
          status: "TRIAL",
        },
      });

      const branch = await tx.branch.create({
        data: {
          organizationId: org.id,
          code: "HQ",
          name: "Head Office",
          isDefault: true,
          isActive: true,
        },
      });

      await tx.warehouse.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          code: "WH-01",
          name: "Main Warehouse",
          isDefault: true,
          isActive: true,
        },
      });

      await tx.cashRegister.create({
        data: {
          branchId: branch.id,
          code: "REG-01",
          name: "Register 1",
          isActive: true,
        },
      });

      for (const perm of PERMISSION_DEFINITIONS) {
        await tx.permission.upsert({
          where: { code: perm.code },
          update: { description: perm.description },
          create: perm,
        });
      }

      await RoleService.syncSystemRolePermissions(org.id, { tx });

      const owner = await tx.user.create({
        data: {
          organizationId: org.id,
          email,
          passwordHash,
          firstName: input.ownerFirstName,
          lastName: input.ownerLastName,
          isActive: true,
        },
      });

      await tx.organization.update({
        where: { id: org.id },
        data: { ownerUserId: owner.id },
      });

      const currentYear = new Date().getFullYear();
      const fiscalYear = await tx.fiscalYear.create({
        data: {
          organizationId: org.id,
          name: `FY ${currentYear}`,
          startDate: new Date(`${currentYear}-01-01`),
          endDate: new Date(`${currentYear}-12-31`),
        },
      });

      for (let month = 0; month < 12; month++) {
        const startDate = new Date(currentYear, month, 1);
        const endDate = new Date(currentYear, month + 1, 0);
        const monthName = startDate.toLocaleString("en", { month: "long" });
        await tx.accountingPeriod.create({
          data: {
            fiscalYearId: fiscalYear.id,
            name: `${monthName} ${currentYear}`,
            startDate,
            endDate,
          },
        });
      }

      const accountIdByCode = new Map<string, string>();
      for (const acct of DEFAULT_CHART_OF_ACCOUNTS) {
        const parentCode =
          acct.code.length > 4 ? acct.code.slice(0, acct.code.length - 2).replace(/0+$/, "") + "00" : null;
        const parentId = parentCode ? accountIdByCode.get(parentCode) : undefined;
        const created = await tx.account.create({
          data: {
            organizationId: org.id,
            parentId,
            code: acct.code,
            name: acct.name,
            type: acct.type,
            subtype: acct.subtype,
            normalBalance: acct.normalBalance,
            isSystem: acct.isSystem,
          },
        });
        accountIdByCode.set(acct.code, created.id);
      }

      await tx.setting.create({
        data: {
          organizationId: org.id,
          key: ACCOUNT_MAPPING_SETTING_KEY,
          value: DEFAULT_ACCOUNT_MAPPING,
        },
      });

      await tx.taxRate.create({
        data: {
          organizationId: org.id,
          name: "Commercial Tax 5%",
          rate: 0.05,
          isDefault: true,
          isActive: true,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: "TRIAL",
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          trialEndsAt: trialEnd,
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          status: "TRIAL",
          note: "Organization created",
        },
      });

      return { org, owner, branch, subscription };
    });

    await prisma.platformAuditLog.create({
      data: {
        action: "CREATE",
        entityType: "Organization",
        entityId: result.org.id,
        organizationId: result.org.id,
        after: {
          name: result.org.name,
          slug: result.org.slug,
          plan: input.planSlug ?? "starter",
        },
      },
    });

    return result;
  }
}

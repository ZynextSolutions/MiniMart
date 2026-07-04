import { prisma } from "@/infrastructure/database/prisma";
import {
  allModulesEnabled,
  defaultModuleMap,
  moduleFlagKey,
  parseModuleFlagKey,
  type PlatformModuleKey,
  PLATFORM_MODULES,
} from "@/platform/modules/platform-modules";
import type { PlanLimits } from "@/platform/subscriptions/plan-limits.types";

export type ModuleOverrideState = "inherit" | "enabled" | "disabled";

export type OrgModuleRow = {
  key: PlatformModuleKey;
  label: string;
  description: string;
  planEnabled: boolean;
  override: ModuleOverrideState;
  effective: boolean;
};

export class ModuleAccessService {
  static getDefaultModules(
    _planSlug?: string,
    planLimits?: PlanLimits | null,
  ): Record<PlatformModuleKey, boolean> {
    const fromLimits = planLimits?.modules;
    if (fromLimits && Object.keys(fromLimits).length > 0) {
      return defaultModuleMap(fromLimits);
    }
    // No explicit module config on plan → full access (existing tenants)
    return allModulesEnabled();
  }

  static async getEnabledModules(
    organizationId: string,
  ): Promise<Record<PlatformModuleKey, boolean>> {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    const planModules = this.getDefaultModules(
      subscription?.plan.slug,
      (subscription?.plan.limits as PlanLimits) ?? null,
    );

    const moduleFlags = await prisma.featureFlag.findMany({
      where: { key: { startsWith: "module." } },
      include: {
        overrides: { where: { organizationId }, take: 1 },
      },
    });

    const result = { ...planModules };

    for (const flag of moduleFlags) {
      const moduleKey = parseModuleFlagKey(flag.key);
      if (!moduleKey) continue;

      if (flag.overrides.length > 0) {
        result[moduleKey] = flag.overrides[0].isEnabled;
      } else if (!flag.isEnabled) {
        result[moduleKey] = false;
      }
    }

    return result;
  }

  static async isModuleEnabled(
    organizationId: string,
    moduleKey: PlatformModuleKey,
  ): Promise<boolean> {
    const modules = await this.getEnabledModules(organizationId);
    return modules[moduleKey];
  }

  static async getOrgModuleRows(organizationId: string): Promise<OrgModuleRow[]> {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    const planModules = this.getDefaultModules(
      subscription?.plan.slug,
      (subscription?.plan.limits as PlanLimits) ?? null,
    );

    const moduleFlags = await prisma.featureFlag.findMany({
      where: { key: { startsWith: "module." } },
      include: {
        overrides: { where: { organizationId }, take: 1 },
      },
    });

    const overrideMap = new Map<PlatformModuleKey, boolean>();
    for (const flag of moduleFlags) {
      const key = parseModuleFlagKey(flag.key);
      if (key && flag.overrides.length > 0) {
        overrideMap.set(key, flag.overrides[0].isEnabled);
      }
    }

    const effective = await this.getEnabledModules(organizationId);

    return PLATFORM_MODULES.map((mod) => {
      const hasOverride = overrideMap.has(mod.key);
      const override: ModuleOverrideState = !hasOverride
        ? "inherit"
        : overrideMap.get(mod.key)
          ? "enabled"
          : "disabled";

      return {
        key: mod.key,
        label: mod.label,
        description: mod.description,
        planEnabled: planModules[mod.key],
        override,
        effective: effective[mod.key],
      };
    });
  }

  static async setOrgModuleOverride(
    organizationId: string,
    moduleKey: PlatformModuleKey,
    state: ModuleOverrideState,
    actorId?: string,
  ) {
    const flagKey = moduleFlagKey(moduleKey);

    let flag = await prisma.featureFlag.findUnique({ where: { key: flagKey } });
    if (!flag) {
      const mod = PLATFORM_MODULES.find((m) => m.key === moduleKey)!;
      flag = await prisma.featureFlag.create({
        data: {
          key: flagKey,
          name: mod.label,
          description: mod.description,
          isEnabled: true,
        },
      });
    }

    if (state === "inherit") {
      await prisma.featureFlagOverride.deleteMany({
        where: { featureFlagId: flag.id, organizationId },
      });
    } else {
      await prisma.featureFlagOverride.upsert({
        where: {
          featureFlagId_organizationId: {
            featureFlagId: flag.id,
            organizationId,
          },
        },
        create: {
          featureFlagId: flag.id,
          organizationId,
          isEnabled: state === "enabled",
        },
        update: { isEnabled: state === "enabled" },
      });
    }

    if (actorId) {
      await prisma.platformAuditLog.create({
        data: {
          platformUserId: actorId,
          action: state === "inherit" ? "CLEAR_OVERRIDE" : "MODULE_OVERRIDE",
          entityType: "OrganizationModule",
          entityId: flag.id,
          organizationId,
          after: { moduleKey, state },
        },
      });
    }
  }
}

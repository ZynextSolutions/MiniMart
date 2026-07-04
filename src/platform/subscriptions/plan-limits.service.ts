import { prisma } from "@/infrastructure/database/prisma";
import { PlanLimitExceededError } from "@/lib/errors/app-error";
import type { NumericPlanLimits, PlanLimits } from "./plan-limits.types";

export class PlanLimitsService {
  static async getLimits(organizationId: string): Promise<NumericPlanLimits> {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (!subscription?.plan) {
      return { maxBranches: 1, maxUsers: 3, maxProducts: 100 };
    }

    const raw = (subscription.plan.limits as PlanLimits) ?? {};
    const { modules: _modules, ...numeric } = raw;
    return numeric;
  }

  static async checkLimit(
    organizationId: string,
    resource: keyof NumericPlanLimits,
    currentCount?: number,
  ): Promise<void> {
    const limits = await this.getLimits(organizationId);
    const max = limits[resource];
    if (max === undefined || max < 0) return;

    let count = currentCount;
    if (count === undefined) {
      count = await this.getCurrentCount(organizationId, resource);
    }

    if (count >= max) {
      const label = resource.replace("max", "").toLowerCase();
      throw new PlanLimitExceededError(
        `Plan limit reached for ${label}. Maximum allowed: ${max}. Please upgrade your plan.`,
      );
    }
  }

  static async getCurrentCount(
    organizationId: string,
    resource: keyof NumericPlanLimits,
  ): Promise<number> {
    switch (resource) {
      case "maxBranches":
        return prisma.branch.count({
          where: { organizationId, deletedAt: null },
        });
      case "maxUsers":
        return prisma.user.count({
          where: { organizationId, deletedAt: null },
        });
      case "maxProducts":
        return prisma.product.count({
          where: { organizationId, deletedAt: null },
        });
      case "maxWarehouses":
        return prisma.warehouse.count({
          where: { organizationId, deletedAt: null },
        });
      default:
        return 0;
    }
  }

  static async getUsage(organizationId: string) {
    const limits = await this.getLimits(organizationId);
    const [branches, users, products, warehouses] = await Promise.all([
      prisma.branch.count({ where: { organizationId, deletedAt: null } }),
      prisma.user.count({ where: { organizationId, deletedAt: null } }),
      prisma.product.count({ where: { organizationId, deletedAt: null } }),
      prisma.warehouse.count({ where: { organizationId, deletedAt: null } }),
    ]);

    return {
      limits,
      usage: {
        branches,
        users,
        products,
        warehouses,
      },
    };
  }
}

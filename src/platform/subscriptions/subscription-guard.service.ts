import type { OrganizationStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { AppError } from "@/lib/errors/app-error";

export class SubscriptionInactiveError extends AppError {
  constructor(message = "Your subscription is not active") {
    super(message, "SUBSCRIPTION_INACTIVE", 402);
    this.name = "SubscriptionInactiveError";
  }
}

const ACTIVE_ORG_STATUSES: OrganizationStatus[] = ["ACTIVE", "TRIAL"];
const ACTIVE_SUB_STATUSES: SubscriptionStatus[] = ["TRIAL", "ACTIVE"];

export class SubscriptionGuardService {
  static async getOrganizationStatus(organizationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        status: true,
        deletedAt: true,
        subscription: { select: { status: true, trialEndsAt: true } },
      },
    });
    return org;
  }

  static isOrganizationAccessible(
    status: OrganizationStatus,
    deletedAt: Date | null,
  ): boolean {
    if (deletedAt) return false;
    return ACTIVE_ORG_STATUSES.includes(status);
  }

  static isSubscriptionActive(
    status: SubscriptionStatus | undefined,
    trialEndsAt: Date | null | undefined,
  ): boolean {
    if (!status) return false;
    if (ACTIVE_SUB_STATUSES.includes(status)) {
      if (status === "TRIAL" && trialEndsAt && trialEndsAt < new Date()) {
        return false;
      }
      return true;
    }
    return false;
  }

  static async assertOrganizationAccess(
    organizationId: string,
    options?: { skipSubscriptionCheck?: boolean },
  ): Promise<void> {
    const org = await this.getOrganizationStatus(organizationId);
    if (!org || !this.isOrganizationAccessible(org.status, org.deletedAt)) {
      throw new Error("ORGANIZATION_SUSPENDED");
    }
    if (options?.skipSubscriptionCheck) return;
    if (!org.subscription) {
      throw new SubscriptionInactiveError("No active subscription found for this organization");
    }
    if (
      !this.isSubscriptionActive(
        org.subscription.status,
        org.subscription.trialEndsAt,
      )
    ) {
      throw new SubscriptionInactiveError();
    }
  }
}

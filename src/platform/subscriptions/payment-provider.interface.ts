import type { Organization, SubscriptionStatus } from "@prisma/client";

export type SubscriptionResult = {
  externalSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
};

export interface PaymentProvider {
  readonly name: string;
  createCustomer(org: Organization): Promise<string>;
  createSubscription(
    planExternalId: string,
    customerId: string,
  ): Promise<SubscriptionResult>;
  cancelSubscription(externalSubscriptionId: string): Promise<void>;
  updateSubscription(
    externalSubscriptionId: string,
    planExternalId: string,
  ): Promise<SubscriptionResult>;
}

/** Placeholder Stripe adapter — implement when billing goes live. */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";

  async createCustomer(_org: Organization): Promise<string> {
    throw new Error("Stripe integration not configured");
  }

  async createSubscription(
    _planExternalId: string,
    _customerId: string,
  ): Promise<SubscriptionResult> {
    throw new Error("Stripe integration not configured");
  }

  async cancelSubscription(_externalSubscriptionId: string): Promise<void> {
    throw new Error("Stripe integration not configured");
  }

  async updateSubscription(
    _planExternalId: string,
    _externalSubscriptionId: string,
  ): Promise<SubscriptionResult> {
    throw new Error("Stripe integration not configured");
  }
}

export class ManualPaymentProvider implements PaymentProvider {
  readonly name = "manual";

  async createCustomer(org: Organization): Promise<string> {
    return `manual_${org.id}`;
  }

  async createSubscription(
    planExternalId: string,
    customerId: string,
  ): Promise<SubscriptionResult> {
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    return {
      externalSubscriptionId: `${customerId}_${planExternalId}`,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: end,
    };
  }

  async cancelSubscription(_externalSubscriptionId: string): Promise<void> {
    return;
  }

  async updateSubscription(
    planExternalId: string,
    externalSubscriptionId: string,
  ): Promise<SubscriptionResult> {
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    return {
      externalSubscriptionId,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: end,
    };
  }
}

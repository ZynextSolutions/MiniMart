import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/infrastructure/database/prisma";
import { PlanLimitsService } from "@/platform/subscriptions/plan-limits.service";
import { SubscriptionGuardService } from "@/platform/subscriptions/subscription-guard.service";
import { BillingClient } from "@/platform/subscriptions/components/billing-client";
import type { PlanLimits } from "@/platform/subscriptions/plan-limits.types";
import { serializeDecimal, serializePlan } from "@/lib/utils/serialize-prisma";
import { ModuleAccessService } from "@/platform/modules/module-access.service";
import { PLATFORM_MODULES } from "@/platform/modules/platform-modules";
import type { PlatformModuleKey } from "@/platform/modules/platform-modules";
import { notFound } from "next/navigation";

const PLATFORM_SUPPORT_EMAIL =
  process.env.PLATFORM_SUPPORT_EMAIL ?? "superadmin@platform.com";

export default async function BillingSettingsPage() {
  const session = await requireSession({ skipSubscriptionCheck: true });
  await authorize(session.user.id, PERMISSIONS.SETTINGS.COMPANY_VIEW, {
    branchId: session.user.branchId ?? undefined,
  });

  const [subscription, usage, enabledModules, availablePlans] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId: session.user.organizationId },
      include: { plan: true },
    }),
    PlanLimitsService.getUsage(session.user.organizationId),
    ModuleAccessService.getEnabledModules(session.user.organizationId),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!subscription) notFound();

  const subscriptionIsActive = SubscriptionGuardService.isSubscriptionActive(
    subscription.status,
    subscription.trialEndsAt,
  );

  const moduleList = PLATFORM_MODULES.filter((m) => enabledModules[m.key]).map(
    (m) => m.label,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription plan and usage.
        </p>
      </div>
      <BillingClient
        subscriptionIsActive={subscriptionIsActive}
        supportEmail={PLATFORM_SUPPORT_EMAIL}
        availablePlans={availablePlans.map((plan) => {
          const serialized = serializePlan(plan);
          return {
            id: serialized.id as string,
            name: serialized.name as string,
            slug: serialized.slug as string,
            description: (serialized.description as string | null) ?? null,
            price: serialized.price as string,
            currency: serialized.currency,
            billingInterval: serialized.billingInterval as string,
            trialDays: serialized.trialDays as number,
          };
        })}
        subscription={{
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
          plan: {
            name: subscription.plan.name,
            slug: subscription.plan.slug,
            price: serializeDecimal(subscription.plan.price),
            currency: subscription.plan.currency ?? "MMK",
            billingInterval: subscription.plan.billingInterval,
            limits: (subscription.plan.limits as PlanLimits) ?? {},
            features: (subscription.plan.features as string[]) ?? [],
            modules: moduleList,
          },
        }}
        enabledModuleKeys={Object.entries(enabledModules)
          .filter(([, on]) => on)
          .map(([key]) => key as PlatformModuleKey)}
        usage={usage}
      />
    </div>
  );
}

import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import { SubscriptionsManager } from "@/platform/admin/components/subscriptions-manager";

export default async function PlatformSubscriptionsPage() {
  const [data, plans] = await Promise.all([
    PlatformAdminService.listSubscriptions(),
    PlatformAdminService.listPlans(),
  ]);

  const serializedSubscriptions = data.items.map((sub) => ({
    id: sub.id,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    organization: sub.organization,
    plan: sub.plan,
  }));

  const planOptions = plans.map((p) => ({ id: p.id, name: p.name, slug: p.slug }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground">All organization subscriptions.</p>
      </div>
      <SubscriptionsManager
        subscriptions={serializedSubscriptions}
        plans={planOptions}
      />
    </div>
  );
}

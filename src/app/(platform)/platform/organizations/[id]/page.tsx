import { notFound } from "next/navigation";
import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import { OrganizationDetailClient } from "@/platform/admin/components/organization-detail-client";
import { OrgModulesManager } from "@/platform/admin/components/org-modules-manager";
import { ModuleAccessService } from "@/platform/modules/module-access.service";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org, plans, moduleRows] = await Promise.all([
    PlatformAdminService.getOrganization(id),
    PlatformAdminService.listPlans(),
    ModuleAccessService.getOrgModuleRows(id),
  ]);
  if (!org || org.deletedAt) notFound();

  const serializedOrg = {
    id: org.id,
    name: org.name,
    slug: org.slug,
    email: org.email,
    phone: org.phone,
    country: org.country,
    currency: org.currency,
    timezone: org.timezone,
    status: org.status,
    createdAt: org.createdAt.toISOString(),
    _count: org._count,
    subscription: org.subscription
      ? {
          id: org.subscription.id,
          status: org.subscription.status,
          currentPeriodStart: org.subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: org.subscription.currentPeriodEnd.toISOString(),
          trialEndsAt: org.subscription.trialEndsAt?.toISOString() ?? null,
          plan: { id: org.subscription.plan.id, name: org.subscription.plan.name },
          events: org.subscription.events.map((e) => ({
            id: e.id,
            status: e.status,
            note: e.note,
            createdAt: e.createdAt.toISOString(),
          })),
        }
      : null,
  };

  const planOptions = plans.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-6">
      <OrganizationDetailClient org={serializedOrg} plans={planOptions} />
      <OrgModulesManager
        organizationId={org.id}
        planName={org.subscription?.plan.name ?? "No plan"}
        modules={moduleRows}
      />
    </div>
  );
}

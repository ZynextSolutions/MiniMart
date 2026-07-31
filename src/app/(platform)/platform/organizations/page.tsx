import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import { OrganizationsTable } from "@/platform/admin/components/organizations-table";
import { CreateOrganizationForm } from "@/platform/admin/components/create-organization-form";
import { serializeOrganizationListItem } from "@/lib/utils/serialize-prisma";
import {
  PLATFORM_PAGE_ROLES,
  PLATFORM_ROLES,
  platformRoleCanAccess,
  requirePlatformPageAccess,
} from "@/platform/auth/platform-roles";

export default async function PlatformOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const session = await requirePlatformPageAccess(...PLATFORM_PAGE_ROLES.organizations);
  const canCreate = platformRoleCanAccess(session.user.platformRole, PLATFORM_ROLES.OPS);
  const params = await searchParams;
  const [data, plans] = await Promise.all([
    PlatformAdminService.listOrganizations({
      search: params.search,
      status: params.status as "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED" | undefined,
    }),
    PlatformAdminService.listPlans(),
  ]);

  const serializedData = {
    ...data,
    items: data.items.map(serializeOrganizationListItem),
  };

  const planOptions = plans
    .filter((p) => p.isActive)
    .map((p) => ({ slug: p.slug, name: p.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground">Manage tenant organizations.</p>
        </div>
        {canCreate ? <CreateOrganizationForm plans={planOptions} /> : null}
      </div>
      <OrganizationsTable data={serializedData} />
    </div>
  );
}

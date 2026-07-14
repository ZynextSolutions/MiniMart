import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { OrganizationService } from "@/features/settings/services/organization.service";
import { CompanySettingsForm } from "@/features/settings/components/company-settings-form";

export default async function CompanySettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.SETTINGS.COMPANY_VIEW);

  const organization = await OrganizationService.getById(
    session.user.organizationId,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization profile and preferences
        </p>
      </div>
      <CompanySettingsForm organization={organization} />
    </div>
  );
}

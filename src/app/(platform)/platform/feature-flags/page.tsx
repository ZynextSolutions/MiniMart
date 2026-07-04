import { FeatureFlagService } from "@/platform/feature-flags/feature-flag.service";
import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import { FeatureFlagsManager } from "@/platform/admin/components/feature-flags-manager";

export default async function PlatformFeatureFlagsPage() {
  const [flags, organizations] = await Promise.all([
    FeatureFlagService.listAll(),
    PlatformAdminService.listOrganizationOptions(),
  ]);

  const overridesByFlag: Record<string, {
    id: string;
    isEnabled: boolean;
    organization: { id: string; name: string; slug: string };
  }[]> = {};

  await Promise.all(
    flags.map(async (flag) => {
      const overrides = await PlatformAdminService.listFeatureFlagOverrides(flag.id);
      overridesByFlag[flag.id] = overrides.map((o) => ({
        id: o.id,
        isEnabled: o.isEnabled,
        organization: o.organization,
      }));
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feature Flags</h1>
        <p className="text-muted-foreground">
          Control feature availability globally and per organization.
        </p>
      </div>
      <FeatureFlagsManager
        flags={flags}
        organizations={organizations}
        overridesByFlag={overridesByFlag}
      />
    </div>
  );
}

import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountMappingSettingsForm } from "@/features/settings/components/account-mapping-settings-form";
import { getAccountMappingSettingsAction } from "@/features/settings/actions/account-mapping.actions";

export default async function AccountMappingSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.SETTINGS.FISCAL_MANAGE);

  const { mapping, accounts } = await getAccountMappingSettingsAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Mapping</h1>
        <p className="text-muted-foreground">
          Configure which ledger accounts are used for automatic journal posting
        </p>
      </div>

      <AccountMappingSettingsForm initialMapping={mapping} accounts={accounts} />
    </div>
  );
}

import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { RoleService } from "@/features/roles/services/role.service";
import { RolesPageClient } from "@/features/roles/components/roles-page-client";

export default async function RolesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.ROLES.VIEW);

  const [roles, permissions] = await Promise.all([
    RoleService.list(session.user.organizationId),
    RoleService.listPermissions(),
  ]);

  return (
    <RolesPageClient
      initialRoles={roles}
      permissions={permissions}
    />
  );
}

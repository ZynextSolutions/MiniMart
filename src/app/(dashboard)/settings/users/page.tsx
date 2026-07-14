import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SYSTEM_ROLES } from "@/lib/permissions/roles";
import { prisma } from "@/infrastructure/database/prisma";
import { UsersPageClient } from "@/features/users/components/users-page-client";
import { UserService } from "@/features/users/services/user.service";
import { RoleService } from "@/features/roles/services/role.service";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.USERS.VIEW);

  const [{ users, total, page, totalPages }, roles, branches, organization] = await Promise.all([
    UserService.list({ organizationId: session.user.organizationId }),
    RoleService.list(session.user.organizationId),
    prisma.branch.findMany({
      where: {
        organizationId: session.user.organizationId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { ownerUserId: true },
    }),
  ]);
  return (
    <UsersPageClient
      initialUsers={users}
      total={total}
      page={page}
      totalPages={totalPages}
      ownerUserId={organization?.ownerUserId ?? null}
      currentUserId={session.user.id}
      roles={roles
        .filter((r) => r.name !== SYSTEM_ROLES.OWNER)
        .map((r) => ({ id: r.id, name: r.name }))}
      branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
    />
  );
}

import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/infrastructure/database/prisma";
import { UsersPageClient } from "@/features/users/components/users-page-client";
import { UserService } from "@/features/users/services/user.service";
import { RoleService } from "@/features/roles/services/role.service";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.USERS.VIEW);

  const [{ users, total, page, totalPages }, roles, branches] = await Promise.all([
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
  ]);

  return (
    <UsersPageClient
      initialUsers={users}
      total={total}
      page={page}
      totalPages={totalPages}
      roles={roles.map((r) => ({ id: r.id, name: r.name }))}
      branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
    />
  );
}

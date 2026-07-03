import { auth } from "@/lib/auth/auth";
import { prisma } from "@/infrastructure/database/prisma";
import { UnauthorizedError, ValidationError } from "@/lib/errors/app-error";
import { authorize } from "@/lib/permissions/authorization";
import type { Permission } from "@/lib/permissions/permissions";

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth>>> & {
  user: NonNullable<NonNullable<Awaited<ReturnType<typeof auth>>>["user"]>;
};

async function assertActiveUser(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    select: { id: true },
  });

  if (!user) {
    throw new UnauthorizedError();
  }
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id || session.error) {
    throw new UnauthorizedError();
  }

  await assertActiveUser(session.user.id);
  return session;
}

export async function requireOrganizationId() {
  const session = await requireSession();
  return session.user.organizationId;
}

export async function requireApiSession(permission?: Permission | string) {
  const session = await requireSession();

  if (permission) {
    await authorize(session.user.id, permission, {
      branchId: session.user.branchId ?? undefined,
    });
  }

  return session;
}

export async function authorizeSession(
  session: AuthSession,
  permission: Permission | string,
  options?: { requireBranch?: boolean },
): Promise<void> {
  const requireBranch = options?.requireBranch ?? true;
  if (requireBranch && !session.user.branchId) {
    throw new ValidationError("No branch selected");
  }

  await authorize(session.user.id, permission, {
    branchId: session.user.branchId ?? undefined,
  });
}

export async function requireBranchSession(permission: Permission | string) {
  const session = await requireSession();
  await authorizeSession(session, permission);
  return session;
}

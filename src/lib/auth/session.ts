import type { Session } from "next-auth";
import { auth } from "@/lib/auth/auth";
import { getPrismaBase } from "@/platform/tenant/tenant-prisma";
import { withOrganizationContext } from "@/platform/tenant/tenant-context";
import { UnauthorizedError, ValidationError } from "@/lib/errors/app-error";
import { authorize } from "@/lib/permissions/authorization";
import type { Permission } from "@/lib/permissions/permissions";
import { SubscriptionGuardService } from "@/platform/subscriptions/subscription-guard.service";

export type AuthSession = Session & {
  user: NonNullable<Session["user"]> & {
    sessionType: "organization";
    organizationId: string;
    branchId: string | null;
    branchIds: string[];
    permissions: string[];
  };
};

async function assertActiveUser(userId: string) {
  const user = await getPrismaBase().user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    select: { id: true },
  });

  if (!user) {
    throw new UnauthorizedError();
  }
}

export async function requireSession(options?: {
  skipSubscriptionCheck?: boolean;
}): Promise<AuthSession> {
  const session = await auth();
  if (
    !session?.user?.id ||
    session.error ||
    session.user.sessionType !== "organization"
  ) {
    throw new UnauthorizedError();
  }

  await assertActiveUser(session.user.id);
  await SubscriptionGuardService.assertOrganizationAccess(
    session.user.organizationId!,
    options,
  );

  return session as AuthSession;
}

export async function requireOrganizationId() {
  const session = await requireSession();
  return session.user.organizationId;
}

type ApiSessionOptions = {
  permission?: Permission | string;
  skipSubscriptionCheck?: boolean;
};

export async function requireApiSession(
  permissionOrOptions?: Permission | string | ApiSessionOptions,
) {
  let permission: Permission | string | undefined;
  let skipSubscriptionCheck = false;

  if (typeof permissionOrOptions === "string") {
    permission = permissionOrOptions;
  } else if (permissionOrOptions) {
    permission = permissionOrOptions.permission;
    skipSubscriptionCheck = permissionOrOptions.skipSubscriptionCheck ?? false;
  }

  const session = await requireSession({ skipSubscriptionCheck });

  return withOrganizationContext(session.user.organizationId, async () => {
    if (permission) {
      await authorize(session.user.id, permission, {
        branchId: session.user.branchId ?? undefined,
      });
    }
    return session;
  });
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

export async function requireBranchSession(
  permission: Permission | string,
): Promise<AuthSession> {
  const session = await requireSession();
  await withOrganizationContext(session.user.organizationId, async () => {
    await authorizeSession(session, permission);
  });
  return session;
}

export async function runWithSessionOrgContext<T>(
  session: AuthSession,
  fn: () => Promise<T>,
): Promise<T> {
  return withOrganizationContext(session.user.organizationId, fn);
}

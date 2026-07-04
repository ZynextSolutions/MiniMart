import type { Session } from "next-auth";
import { auth } from "@/lib/auth/auth";
import { getPrismaBase } from "@/platform/tenant/tenant-prisma";
import { UnauthorizedError } from "@/lib/errors/app-error";

export type PlatformSession = Session & {
  user: {
    id: string;
    email: string;
    name: string;
    sessionType: "platform";
    platformRole: string;
  };
};

export async function requirePlatformSession(): Promise<PlatformSession> {
  const session = await auth();
  if (
    !session?.user?.id ||
    (session.user as { sessionType?: string }).sessionType !== "platform"
  ) {
    throw new UnauthorizedError("Platform authentication required");
  }

  const user = await getPrismaBase().platformUser.findFirst({
    where: { id: session.user.id, isActive: true },
    select: { id: true },
  });
  if (!user) throw new UnauthorizedError();

  return session as PlatformSession;
}

export async function requireOrgSessionFromContext() {
  const session = await auth();
  if (
    !session?.user?.id ||
    (session.user as { sessionType?: string }).sessionType === "platform"
  ) {
    throw new UnauthorizedError();
  }
  if (session.error) throw new UnauthorizedError();
  return session;
}

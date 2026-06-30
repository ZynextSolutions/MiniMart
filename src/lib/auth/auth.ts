import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/infrastructure/database/prisma";
import { getUserBranches, getUserPermissions } from "@/lib/permissions/authorization";
import { authConfig } from "./auth.config";
import { getClientIp, enforceLoginRateLimit } from "@/lib/rate-limit";
import { RateLimitError } from "@/lib/errors/app-error";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.currency = user.currency;
        token.branchId = user.branchId;
        token.branchIds = user.branchIds;
        token.permissions = user.permissions;
        delete token.error;
      }

      if (trigger === "update" && session) {
        if (session.user?.branchId) token.branchId = session.user.branchId;
        if (session.user?.permissions) token.permissions = session.user.permissions;
        if (session.user?.currency) token.currency = session.user.currency;
      }

      if (token.id && !user) {
        const activeUser = await prisma.user.findFirst({
          where: {
            id: token.id as string,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!activeUser) {
          token.error = "SessionExpired";
          return token;
        }

        const branches = await getUserBranches(token.id as string);
        const branchIds = branches.map((branch) => branch.id);
        token.branchIds = branchIds;

        let branchId = token.branchId as string | null | undefined;
        if (branchId && !branchIds.includes(branchId)) {
          branchId = branches[0]?.id ?? null;
          token.branchId = branchId;
        }

        const permissions = branchId
          ? await getUserPermissions(token.id as string, branchId)
          : new Set<string>();
        token.permissions = Array.from(permissions);
        delete token.error;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.error) {
        return {
          ...session,
          user: undefined,
          expires: new Date(0).toISOString(),
          error: token.error as string,
        };
      }

      if (session.user) {
        session.user.id = token.id as string;
        session.user.organizationId = token.organizationId as string;
        session.user.organizationName = token.organizationName as string;
        session.user.currency = token.currency as string;
        session.user.branchId = token.branchId as string | null;
        session.user.branchIds = token.branchIds as string[];
        session.user.permissions = token.permissions as string[];
      }

      return session;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase();

        try {
          const headerStore = await headers();
          const ip = getClientIp({ headers: headerStore });
          await enforceLoginRateLimit(normalizedEmail, ip);
        } catch (error) {
          if (error instanceof RateLimitError) return null;
          throw error;
        }

        const user = await prisma.user.findFirst({
          where: {
            email: normalizedEmail,
            isActive: true,
            deletedAt: null,
          },
          include: { organization: true },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const branches = await getUserBranches(user.id);
        const defaultBranch = branches.find((b) => b.isDefault) ?? branches[0];
        const permissions = defaultBranch
          ? await getUserPermissions(user.id, defaultBranch.id)
          : new Set<string>();

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          organizationId: user.organizationId,
          organizationName: user.organization.name,
          currency: user.organization.currency,
          branchId: defaultBranch?.id ?? null,
          branchIds: branches.map((b) => b.id),
          permissions: Array.from(permissions),
        };
      },
    }),
  ],
});

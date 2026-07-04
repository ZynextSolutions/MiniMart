import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";
import { getPrismaBase } from "@/platform/tenant/tenant-prisma";
import { getUserBranches, getUserPermissions } from "@/lib/permissions/authorization";
import { authConfig } from "./auth.config";
import { getClientIp, enforceLoginRateLimit } from "@/lib/rate-limit";
import { RateLimitError } from "@/lib/errors/app-error";

const orgLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationSlug: z.string().optional(),
  loginType: z.literal("organization").optional(),
});

const platformLoginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1),
});

const loginSchema = z.union([orgLoginSchema, platformLoginSchema]);

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.sessionType = user.sessionType;
        token.organizationId = user.organizationId ?? "";
        token.organizationName = user.organizationName ?? "";
        token.organizationSlug = user.organizationSlug ?? "";
        token.organizationStatus = user.organizationStatus ?? "ACTIVE";
        token.currency = user.currency ?? "MMK";
        token.branchId = user.branchId ?? null;
        token.branchIds = user.branchIds ?? [];
        token.permissions = user.permissions ?? [];
        token.platformRole = user.platformRole;
        delete token.error;
      }

      if (trigger === "update" && session) {
        if (session.user?.branchId) token.branchId = session.user.branchId;
        if (session.user?.permissions) token.permissions = session.user.permissions;
        if (session.user?.currency) token.currency = session.user.currency;
      }

      if (token.sessionType === "platform" && token.id && !user) {
        const active = await getPrismaBase().platformUser.findFirst({
          where: { id: token.id as string, isActive: true },
          select: { id: true, role: true },
        });
        if (!active) {
          token.error = "SessionExpired";
          return token;
        }
        token.platformRole = active.role;
        delete token.error;
        return token;
      }

      if (token.sessionType === "organization" && token.id && !user) {
        const activeUser = await getPrismaBase().user.findFirst({
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

        const organization = await getPrismaBase().organization.findUnique({
          where: { id: token.organizationId as string },
          select: { currency: true, name: true, slug: true, status: true, deletedAt: true },
        });
        if (organization) {
          token.currency = organization.currency;
          token.organizationName = organization.name;
          token.organizationSlug = organization.slug;
          token.organizationStatus = organization.status;
          if (organization.deletedAt || organization.status === "SUSPENDED" || organization.status === "CANCELLED") {
            token.error = "OrganizationSuspended";
          } else {
            delete token.error;
          }
        }
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
        session.user.sessionType = (token.sessionType as "organization" | "platform") ?? "organization";
        session.user.organizationId = (token.organizationId as string) ?? "";
        session.user.organizationName = (token.organizationName as string) ?? "";
        session.user.organizationSlug = (token.organizationSlug as string) ?? "";
        session.user.organizationStatus = (token.organizationStatus as string) ?? "ACTIVE";
        session.user.currency = (token.currency as string) ?? "MMK";
        session.user.branchId = (token.branchId as string | null) ?? null;
        session.user.branchIds = (token.branchIds as string[]) ?? [];
        session.user.permissions = (token.permissions as string[]) ?? [];
        session.user.platformRole = token.platformRole as string | undefined;
      }

      return session;
    },
  },
  providers: [
    Credentials({
      id: "organization",
      name: "Organization",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        organizationSlug: { label: "Organization", type: "text" },
      },
      async authorize(credentials) {
        const parsed = orgLoginSchema.safeParse({
          ...credentials,
          loginType: "organization",
        });
        if (!parsed.success) return null;

        const { email, password, organizationSlug } = parsed.data;
        const normalizedEmail = email.toLowerCase();

        try {
          const headerStore = await headers();
          const ip = getClientIp({ headers: headerStore });
          await enforceLoginRateLimit(normalizedEmail, ip);
        } catch (error) {
          if (error instanceof RateLimitError) return null;
          throw error;
        }

        const users = await getPrismaBase().user.findMany({
          where: {
            email: normalizedEmail,
            isActive: true,
            deletedAt: null,
          },
          include: {
            organization: {
              include: { subscription: true },
            },
          },
        });

        if (!users.length) return null;

        let user = users[0];
        if (users.length > 1) {
          if (!organizationSlug) return null;
          const matched = users.find((u) => u.organization.slug === organizationSlug);
          if (!matched) return null;
          user = matched;
        }

        const org = user.organization;
        if (org.deletedAt || org.status === "SUSPENDED" || org.status === "CANCELLED") {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const branches = await getUserBranches(user.id);
        const defaultBranch = branches.find((b) => b.isDefault) ?? branches[0];
        const permissions = defaultBranch
          ? await getUserPermissions(user.id, defaultBranch.id)
          : new Set<string>();

        await getPrismaBase().user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          sessionType: "organization" as const,
          organizationId: user.organizationId,
          organizationName: org.name,
          organizationSlug: org.slug,
          organizationStatus: org.status,
          currency: org.currency,
          branchId: defaultBranch?.id ?? null,
          branchIds: branches.map((b) => b.id),
          permissions: Array.from(permissions),
        };
      },
    }),
    Credentials({
      id: "platform",
      name: "Platform",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = platformLoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase();

        try {
          const headerStore = await headers();
          const ip = getClientIp({ headers: headerStore });
          await enforceLoginRateLimit(`platform:${normalizedEmail}`, ip);
        } catch (error) {
          if (error instanceof RateLimitError) return null;
          throw error;
        }

        const platformUser = await getPrismaBase().platformUser.findFirst({
          where: { email: normalizedEmail, isActive: true },
        });
        if (!platformUser) return null;

        const valid = await bcrypt.compare(password, platformUser.passwordHash);
        if (!valid) return null;

        await getPrismaBase().platformUser.update({
          where: { id: platformUser.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: platformUser.id,
          email: platformUser.email,
          name: `${platformUser.firstName} ${platformUser.lastName}`,
          sessionType: "platform" as const,
          platformRole: platformUser.role,
          organizationId: "",
          organizationName: "",
          organizationSlug: "",
          organizationStatus: "ACTIVE",
          currency: "MMK",
          branchId: null,
          branchIds: [],
          permissions: [],
        };
      },
    }),
  ],
});

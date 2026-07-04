import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.sessionType = user.sessionType;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.organizationSlug = user.organizationSlug;
        token.organizationStatus = user.organizationStatus;
        token.currency = user.currency;
        token.branchId = user.branchId;
        token.branchIds = user.branchIds;
        token.permissions = user.permissions;
        token.platformRole = user.platformRole;
      }

      if (trigger === "update" && session) {
        if (session.user?.branchId) token.branchId = session.user.branchId;
        if (session.user?.permissions) token.permissions = session.user.permissions;
        if (session.user?.currency) token.currency = session.user.currency;
      }

      return token;
    },
    async session({ session, token }) {
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
  trustHost: true,
} satisfies NextAuthConfig;

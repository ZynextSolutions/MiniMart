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
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.currency = user.currency;
        token.branchId = user.branchId;
        token.branchIds = user.branchIds;
        token.permissions = user.permissions;
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
  trustHost: true,
} satisfies NextAuthConfig;

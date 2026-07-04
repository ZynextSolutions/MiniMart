import type { DefaultSession } from "next-auth";

export type SessionType = "organization" | "platform";

declare module "next-auth" {
  interface Session {
    error?: string;
    user: {
      id: string;
      sessionType: SessionType;
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      organizationStatus: string;
      subscriptionStatus?: string;
      currency: string;
      branchId: string | null;
      branchIds: string[];
      permissions: string[];
      platformRole?: string;
    } & DefaultSession["user"];
  }

  interface User {
    sessionType: SessionType;
    organizationId?: string;
    organizationName?: string;
    organizationSlug?: string;
    organizationStatus?: string;
    subscriptionStatus?: string;
    currency?: string;
    branchId?: string | null;
    branchIds?: string[];
    permissions?: string[];
    platformRole?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    sessionType: SessionType;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    organizationStatus: string;
    subscriptionStatus?: string;
    currency: string;
    branchId: string | null;
    branchIds: string[];
    permissions: string[];
    platformRole?: string;
    error?: string;
  }
}

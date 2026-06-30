import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    error?: string;
    user: {
      id: string;
      organizationId: string;
      organizationName: string;
      currency: string;
      branchId: string | null;
      branchIds: string[];
      permissions: string[];
    } & DefaultSession["user"];
  }

  interface User {
    organizationId: string;
    organizationName: string;
    currency: string;
    branchId: string | null;
    branchIds: string[];
    permissions: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    organizationId: string;
    organizationName: string;
    currency: string;
    branchId: string | null;
    branchIds: string[];
    permissions: string[];
    error?: string;
  }
}

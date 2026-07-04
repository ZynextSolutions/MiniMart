export {
  getPrisma,
  getPrismaBase,
  type PrismaTransactionClient,
  type TenantPrismaClient,
} from "@/platform/tenant/tenant-prisma";

/** Default Prisma client (base, for transactions and platform queries). */
import { getPrismaBase } from "@/platform/tenant/tenant-prisma";
export const prisma = getPrismaBase();

/** Tenant-scoped Prisma with auto-injection when org context is set. */
import { getPrisma } from "@/platform/tenant/tenant-prisma";
export const tenantPrisma = getPrisma();

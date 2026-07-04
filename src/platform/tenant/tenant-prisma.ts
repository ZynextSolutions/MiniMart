import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";
import { getTenantContext } from "./tenant-context";
import { TENANT_SCOPED_MODELS } from "./tenant-scoped-models";

function injectOrganizationId(
  args: Record<string, unknown>,
  organizationId: string,
): Record<string, unknown> {
  const where = (args.where as Record<string, unknown> | undefined) ?? {};
  return {
    ...args,
    where: {
      ...where,
      organizationId,
    },
  };
}

function createTenantExtension(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = getTenantContext();
          if (!ctx?.enforce || !ctx.organizationId) {
            return query(args);
          }

          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const readOps = new Set([
            "findMany",
            "findFirst",
            "findUnique",
            "count",
            "aggregate",
            "groupBy",
          ]);
          const writeOps = new Set([
            "update",
            "updateMany",
            "delete",
            "deleteMany",
          ]);
          const createOps = new Set(["create", "createMany"]);

          if (readOps.has(operation) || writeOps.has(operation)) {
            const nextArgs = injectOrganizationId(
              args as Record<string, unknown>,
              ctx.organizationId,
            );
            return query(nextArgs);
          }

          if (createOps.has(operation)) {
            const data = (args as { data?: Record<string, unknown> }).data;
            if (data && typeof data === "object" && !Array.isArray(data)) {
              const nextArgs = {
                ...args,
                data: {
                  ...data,
                  organizationId: ctx.organizationId,
                },
              };
              return query(nextArgs);
            }
          }

          return query(args);
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof createTenantExtension>;

export function getPrismaBase(): PrismaClient {
  const globalForPrisma = globalThis as unknown as {
    prismaBase: PrismaClient | undefined;
  };

  if (!globalForPrisma.prismaBase) {
    globalForPrisma.prismaBase = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : ["error"],
    });
  }

  return globalForPrisma.prismaBase;
}

export function getPrisma(): TenantPrismaClient {
  const globalForPrisma = globalThis as unknown as {
    prismaExtended: TenantPrismaClient | undefined;
  };

  if (!globalForPrisma.prismaExtended) {
    globalForPrisma.prismaExtended = createTenantExtension(getPrismaBase());
  }

  return globalForPrisma.prismaExtended;
}

export type PrismaTransactionClient = Parameters<
  Parameters<ReturnType<typeof getPrismaBase>["$transaction"]>[0]
>[0];

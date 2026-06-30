import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";

export interface AuditLogInput {
  organizationId: string;
  userId?: string | null;
  branchId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  static async log(input: AuditLogInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        branchId: input.branchId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: input.before as Prisma.InputJsonValue | undefined,
        after: input.after as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }
}

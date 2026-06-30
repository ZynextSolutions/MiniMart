import { prisma } from "@/infrastructure/database/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";

export interface UpdateOrganizationInput {
  name?: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  currency?: string;
  timezone?: string;
}

export class OrganizationService {
  static async getById(id: string) {
    const org = await prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
    if (!org) throw new NotFoundError("Organization");
    return org;
  }

  static async update(
    id: string,
    data: UpdateOrganizationInput,
    actorId: string,
  ) {
    const before = await this.getById(id);

    const org = await prisma.organization.update({
      where: { id },
      data,
    });

    await AuditService.log({
      organizationId: id,
      userId: actorId,
      action: "organization.updated",
      entityType: "Organization",
      entityId: id,
      before: { name: before.name, email: before.email },
      after: { name: org.name, email: org.email },
    });

    return org;
  }
}

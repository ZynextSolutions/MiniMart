import { prisma } from "@/infrastructure/database/prisma";

export class FeatureFlagService {
  static async isEnabled(
    organizationId: string | null,
    key: string,
  ): Promise<boolean> {
    const flag = await prisma.featureFlag.findUnique({
      where: { key },
      include: {
        overrides: organizationId
          ? { where: { organizationId }, take: 1 }
          : false,
      },
    });

    if (!flag) return false;

    if (organizationId && flag.overrides?.length) {
      return flag.overrides[0].isEnabled;
    }

    return flag.isEnabled;
  }

  static async listAll() {
    return prisma.featureFlag.findMany({
      orderBy: { key: "asc" },
      include: { _count: { select: { overrides: true } } },
    });
  }

  static async upsert(
    data: {
      key: string;
      name: string;
      description?: string;
      isEnabled: boolean;
    },
    actorId?: string,
  ) {
    const result = await prisma.featureFlag.upsert({
      where: { key: data.key },
      create: data,
      update: {
        name: data.name,
        description: data.description,
        isEnabled: data.isEnabled,
      },
    });

    if (actorId) {
      await prisma.platformAuditLog.create({
        data: {
          platformUserId: actorId,
          action: "UPSERT",
          entityType: "FeatureFlag",
          entityId: result.id,
          after: result,
        },
      });
    }

    return result;
  }

  static async setOrgOverride(
    organizationId: string,
    key: string,
    isEnabled: boolean,
    actorId?: string,
  ) {
    const flag = await prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new Error(`Feature flag not found: ${key}`);

    const result = await prisma.featureFlagOverride.upsert({
      where: {
        featureFlagId_organizationId: {
          featureFlagId: flag.id,
          organizationId,
        },
      },
      create: { featureFlagId: flag.id, organizationId, isEnabled },
      update: { isEnabled },
    });

    if (actorId) {
      await prisma.platformAuditLog.create({
        data: {
          platformUserId: actorId,
          action: "OVERRIDE",
          entityType: "FeatureFlag",
          entityId: flag.id,
          organizationId,
          after: { isEnabled },
        },
      });
    }

    return result;
  }
}

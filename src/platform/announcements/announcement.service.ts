import { getPrismaBase } from "@/platform/tenant/tenant-prisma";

export type AnnouncementType = "info" | "warning" | "success" | "error";

export class AnnouncementService {
  /** Active global + org-specific announcements visible right now. */
  static async listActiveForOrganization(organizationId: string) {
    const now = new Date();

    return getPrismaBase().announcement.findMany({
      where: {
        isActive: true,
        OR: [{ organizationId: null }, { organizationId }],
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        organizationId: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
      },
    });
  }
}

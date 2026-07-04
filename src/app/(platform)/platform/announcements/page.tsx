import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import { AnnouncementsManager } from "@/platform/admin/components/announcements-manager";

export default async function PlatformAnnouncementsPage() {
  const [announcements, organizations] = await Promise.all([
    PlatformAdminService.listAnnouncements(),
    PlatformAdminService.listOrganizationOptions(),
  ]);

  const serializedAnnouncements = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    message: a.message,
    type: a.type,
    organizationId: a.organizationId,
    isActive: a.isActive,
    startsAt: a.startsAt?.toISOString() ?? null,
    endsAt: a.endsAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="text-muted-foreground">Platform-wide and per-org announcements.</p>
      </div>
      <AnnouncementsManager
        announcements={serializedAnnouncements}
        organizations={organizations}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { authorizeSession } from "@/lib/auth/session";
import type { NotificationType } from "@prisma/client";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { NOTIFICATION_FILTER_TYPES } from "@/lib/constants/notifications";
import { NotificationService } from "@/lib/services/notification-service";
import { NotificationsPageClient } from "@/features/notifications/components/notifications-page-client";

export const metadata: Metadata = {
  title: "Notifications | Mini Mart ERP",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await authorizeSession(session, PERMISSIONS.NOTIFICATIONS.VIEW);

  const params = await searchParams;
  const typeFilter = NOTIFICATION_FILTER_TYPES.includes(params.type as NotificationType)
    ? (params.type as NotificationType)
    : undefined;

  try {
    await NotificationService.runScheduledChecks({
      organizationId: session.user.organizationId,
      branchId: session.user.branchId ?? undefined,
      userId: session.user.id,
    });
  } catch (error) {
    console.error("Notification scheduled checks failed:", error);
  }

  const [notifications, unreadCount] = await Promise.all([
    NotificationService.listForUser(session.user.id, { type: typeFilter }),
    NotificationService.getUnreadCount(session.user.id),
  ]);

  return (
    <NotificationsPageClient
      unreadCount={unreadCount}
      activeType={typeFilter}
      notifications={notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
        href: NotificationService.getDeepLink(n.type, n.data),
      }))}
    />
  );
}

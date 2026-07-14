"use server";

import { requireSession, authorizeSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { NotificationService } from "@/lib/services/notification-service";
import { revalidatePath } from "next/cache";

export async function getNotificationsAction() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.NOTIFICATIONS.VIEW);

  const [notifications, unreadCount] = await Promise.all([
    NotificationService.listForUser(session.user.id),
    NotificationService.getUnreadCount(session.user.id),
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      href: NotificationService.getDeepLink(n.type, n.data),
    })),
    unreadCount,
  };
}

export async function getUnreadNotificationCountAction() {
  const session = await requireSession();
  return NotificationService.getUnreadCount(session.user.id);
}

export async function markNotificationReadAction(notificationId: string) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.NOTIFICATIONS.VIEW);
  await NotificationService.markAsRead(session.user.id, notificationId);
  revalidatePath("/notifications");
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.NOTIFICATIONS.VIEW);
  await NotificationService.markAllAsRead(session.user.id);
  revalidatePath("/notifications");
  return { success: true };
}

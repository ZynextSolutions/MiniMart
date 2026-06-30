"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { NotificationType } from "@prisma/client";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Package,
  CreditCard,
  Info,
  ShoppingCart,
  BarChart3,
  Wallet,
  Percent,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import {
  NOTIFICATION_FILTER_TYPES,
  NOTIFICATION_TYPE_META,
} from "@/lib/constants/notifications";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions/notification.actions";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  href: string | null;
}

interface NotificationsPageClientProps {
  notifications: NotificationItem[];
  unreadCount: number;
  activeType?: NotificationType;
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case "LOW_STOCK":
      return <Package className="h-4 w-4 text-amber-600" />;
    case "EXPIRY_WARNING":
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case "NEW_PURCHASE_ARRIVAL":
      return <Truck className="h-4 w-4 text-blue-600" />;
    case "DAILY_SALES_SUMMARY":
      return <BarChart3 className="h-4 w-4 text-emerald-600" />;
    case "CASH_DRAWER_NOT_CLOSED":
      return <Wallet className="h-4 w-4 text-orange-600" />;
    case "LARGE_DISCOUNT":
      return <Percent className="h-4 w-4 text-violet-600" />;
    case "SUSPICIOUS_TRANSACTION":
      return <ShieldAlert className="h-4 w-4 text-destructive" />;
    case "PAYMENT_DUE":
      return <CreditCard className="h-4 w-4 text-blue-600" />;
    case "APPROVAL_REQUIRED":
      return <ShoppingCart className="h-4 w-4 text-amber-600" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

export function NotificationsPageClient({
  notifications,
  unreadCount: initialUnread,
  activeType,
}: NotificationsPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  function handleClick(notification: NotificationItem) {
    startTransition(async () => {
      if (!notification.isRead) {
        await markNotificationReadAction(notification.id);
      }
      if (notification.href) {
        router.push(notification.href);
      } else {
        router.refresh();
      }
    });
  }

  function filterHref(type?: NotificationType) {
    return type ? `/notifications?type=${type}` : "/notifications";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            {initialUnread > 0
              ? `${initialUnread} unread notification${initialUnread === 1 ? "" : "s"}`
              : "All caught up"}
          </p>
        </div>
        {initialUnread > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isPending}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          variant={activeType ? "outline" : "default"}
          size="sm"
        >
          <Link href={filterHref()}>All</Link>
        </Button>
        {NOTIFICATION_FILTER_TYPES.map((type) => (
          <Button
            key={type}
            asChild
            variant={activeType === type ? "default" : "outline"}
            size="sm"
          >
            <Link href={filterHref(type)}>{NOTIFICATION_TYPE_META[type].label}</Link>
          </Button>
        ))}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="mb-4 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No notifications yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Alerts for low stock, expiring products, purchase arrivals, daily sales,
              open cash drawers, large discounts, and suspicious transactions appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleClick(n)}
              disabled={isPending}
              className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${
                !n.isRead ? "border-primary/30 bg-primary/5" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <NotificationIcon type={n.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{n.title}</span>
                    <Badge variant="secondary" className="text-xs">
                      {NOTIFICATION_TYPE_META[n.type as NotificationType]?.label ?? n.type}
                    </Badge>
                    {!n.isRead && (
                      <Badge variant="default" className="text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    {n.href && (
                      <>
                        {" · "}
                        <Link
                          href={n.href}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View details
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

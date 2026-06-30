"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getUnreadNotificationCountAction } from "@/features/notifications/actions/notification.actions";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const count = await getUnreadNotificationCountAction();
        if (mounted) setUnreadCount(count);
      } catch {
        // User may lack permission — hide badge silently
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Button variant="ghost" size="icon" className="relative" asChild>
      <Link href="/notifications">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center px-1 text-[10px]"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
        <span className="sr-only">
          Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ""}
        </span>
      </Link>
    </Button>
  );
}

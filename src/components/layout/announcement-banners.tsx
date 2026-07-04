"use client";

import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AnnouncementBanner = {
  id: string;
  title: string;
  message: string;
  type: string;
};

const DISMISS_KEY = "pos-dismissed-announcements";

const TYPE_STYLES: Record<
  string,
  { container: string; icon: typeof Info }
> = {
  info: {
    container:
      "border-blue-500/50 bg-blue-50 text-blue-950 dark:bg-blue-950/30 dark:text-blue-100",
    icon: Info,
  },
  warning: {
    container:
      "border-amber-500/60 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100",
    icon: AlertTriangle,
  },
  success: {
    container:
      "border-emerald-500/50 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100",
    icon: CheckCircle2,
  },
  error: {
    container:
      "border-red-500/50 bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-100",
    icon: AlertCircle,
  },
};

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
}

export function AnnouncementBanners({
  announcements,
}: {
  announcements: AnnouncementBanner[];
}) {
  const [visible, setVisible] = useState<AnnouncementBanner[]>([]);

  useEffect(() => {
    const dismissed = new Set(readDismissed());
    setVisible(announcements.filter((a) => !dismissed.has(a.id)));
  }, [announcements]);

  function dismiss(id: string) {
    const dismissed = readDismissed();
    if (!dismissed.includes(id)) {
      writeDismissed([...dismissed, id]);
    }
    setVisible((current) => current.filter((a) => a.id !== id));
  }

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 border-b bg-background px-4 py-3 lg:px-6">
      {visible.map((announcement) => {
        const style = TYPE_STYLES[announcement.type] ?? TYPE_STYLES.info;
        const Icon = style.icon;

        return (
          <div
            key={announcement.id}
            role="status"
            className={cn(
              "flex gap-3 rounded-lg border p-3 text-sm",
              style.container,
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold">{announcement.title}</p>
              <p className="whitespace-pre-wrap opacity-90">{announcement.message}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => dismiss(announcement.id)}
              aria-label={`Dismiss ${announcement.title}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

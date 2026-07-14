"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  CreditCard,
  Flag,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Server,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { platformRoleCanAccess, PLATFORM_ROLES } from "@/platform/auth/platform-roles.shared";
import type { PlatformUserRole } from "@prisma/client";

const SIDEBAR_COLLAPSED_KEY = "platform-sidebar-icon-collapsed";

const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: PlatformUserRole[];
}[] = [
  { href: "/platform", label: "Dashboard", icon: LayoutDashboard, roles: PLATFORM_ROLES.ALL },
  { href: "/platform/organizations", label: "Organizations", icon: Building2, roles: PLATFORM_ROLES.ALL },
  { href: "/platform/plans", label: "Plans", icon: CreditCard, roles: PLATFORM_ROLES.BILLING },
  { href: "/platform/subscriptions", label: "Subscriptions", icon: Shield, roles: PLATFORM_ROLES.BILLING },
  { href: "/platform/users", label: "Platform Users", icon: Users, roles: PLATFORM_ROLES.ADMIN },
  { href: "/platform/support", label: "Support", icon: LifeBuoy, roles: PLATFORM_ROLES.ALL },
  { href: "/platform/announcements", label: "Announcements", icon: Megaphone, roles: PLATFORM_ROLES.OPS },
  { href: "/platform/feature-flags", label: "Feature Flags", icon: Flag, roles: PLATFORM_ROLES.ADMIN },
  { href: "/platform/audit-logs", label: "Audit Logs", icon: ScrollText, roles: PLATFORM_ROLES.ALL },
  { href: "/platform/monitoring", label: "Monitoring", icon: Server, roles: PLATFORM_ROLES.ALL },
];

export function PlatformSidebar({
  className,
  platformRole = "SUPPORT",
  collapsible = true,
}: {
  className?: string;
  platformRole?: string;
  /** When false, sidebar stays expanded (e.g. mobile sheet). Default true. */
  collapsible?: boolean;
}) {
  const pathname = usePathname();
  const [iconCollapsed, setIconCollapsed] = useState(false);
  const visibleItems = navItems.filter((item) =>
    platformRoleCanAccess(platformRole, item.roles),
  );

  useEffect(() => {
    if (!collapsible) return;
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "true") setIconCollapsed(true);
    } catch {
      // ignore
    }
  }, [collapsible]);

  function toggleIconCollapsed() {
    setIconCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const isIconMode = collapsible && iconCollapsed;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col border-r bg-sidebar transition-[width] duration-200",
          isIconMode ? "w-16" : "w-64",
          className,
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center border-b",
            isIconMode ? "justify-center px-2" : "gap-2 px-4",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-4 w-4" />
          </div>
          {!isIconMode && (
            <span className="min-w-0 flex-1 truncate font-semibold">Platform Admin</span>
          )}
          {collapsible && !isIconMode && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={toggleIconCollapsed}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ScrollArea className={cn("flex-1 py-4", isIconMode ? "px-2" : "px-3")}>
          {isIconMode ? (
            <div className="flex flex-col items-center gap-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/platform" && pathname.startsWith(item.href));

                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                        )}
                        aria-label={item.label}
                      >
                        <Icon className="h-4 w-4" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
              <div className="mt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={toggleIconCollapsed}
                      aria-label="Expand sidebar"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Expand sidebar</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : (
            <nav className="space-y-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/platform" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </ScrollArea>

        <div className={cn("border-t", isIconMode ? "p-2" : "p-3")}>
          {isIconMode ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" asChild>
                  <Link
                    href="/api/auth/signout?callbackUrl=/platform-login"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="outline" className="w-full" asChild>
              <Link href="/api/auth/signout?callbackUrl=/platform-login">Sign out</Link>
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

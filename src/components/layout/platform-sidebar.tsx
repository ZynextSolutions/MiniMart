"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  Flag,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  ScrollText,
  Server,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { platformRoleCanAccess, PLATFORM_ROLES } from "@/platform/auth/platform-roles.shared";
import type { PlatformUserRole } from "@prisma/client";

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
}: {
  className?: string;
  platformRole?: string;
}) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) =>
    platformRoleCanAccess(platformRole, item.roles),
  );

  return (
    <aside
      className={cn(
        "flex w-64 flex-col border-r bg-card",
        className,
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        <Shield className="mr-2 h-5 w-5 text-primary" />
        <span className="font-semibold">Platform Admin</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
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
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <Button variant="outline" className="w-full" asChild>
          <Link href="/api/auth/signout?callbackUrl=/platform-login">Sign out</Link>
        </Button>
      </div>
    </aside>
  );
}

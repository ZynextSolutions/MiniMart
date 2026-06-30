"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

const labelMap: Record<string, string> = {
  settings: "Settings",
  users: "Users",
  roles: "Roles",
  company: "Company",
  "audit-logs": "Audit Logs",
  notifications: "Notifications",
  products: "Products",
  inventory: "Inventory",
  purchasing: "Purchasing",
  suppliers: "Suppliers",
  customers: "Customers",
  accounting: "Accounting",
  reports: "Reports",
  pos: "POS",
  barcode: "Barcode",
};

function formatSegment(segment: string): string {
  return (
    labelMap[segment] ??
    segment
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function BreadcrumbNav() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <nav className="flex items-center text-sm text-muted-foreground">
        <Home className="mr-2 h-4 w-4" />
        <span className="font-medium text-foreground">Dashboard</span>
      </nav>
    );
  }

  return (
    <nav className="hidden items-center text-sm text-muted-foreground md:flex">
      <Link href="/" className="flex items-center hover:text-foreground">
        <Home className="h-4 w-4" />
      </Link>
      {segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        const label = formatSegment(segment);

        return (
          <Fragment key={href}>
            <ChevronRight className="mx-2 h-4 w-4" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground">
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

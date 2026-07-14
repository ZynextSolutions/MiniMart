"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  mainNavGroups,
  settingsNavItems,
  type NavItem,
} from "@/lib/constants/navigation";
import { usePermission } from "@/hooks/use-permission";
import { useModules } from "@/components/providers/module-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Store,
} from "lucide-react";

const SIDEBAR_COLLAPSED_KEY = "sidebar-icon-collapsed";

interface AppSidebarProps {
  organizationName?: string;
  className?: string;
  /** When false, sidebar stays expanded (e.g. mobile sheet). Default true. */
  collapsible?: boolean;
}

type VisibleNavItem = NavItem & { children?: NavItem[] };

export function AppSidebar({
  organizationName,
  className,
  collapsible = true,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { hasPermission } = usePermission();
  const { isModuleEnabled } = useModules();
  const [iconCollapsed, setIconCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

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

  const isItemActive = useCallback(
    (href: string, peers: string[] = []) => {
      if (href === "/") return pathname === "/";

      const matches = (candidate: string) =>
        pathname === candidate || pathname.startsWith(`${candidate}/`);

      if (!matches(href)) return false;

      const longerPeer = peers.find(
        (peer) => peer !== href && peer.startsWith(href) && matches(peer),
      );

      return !longerPeer;
    },
    [pathname],
  );

  const navItemIsActive = useCallback(
    (item: Pick<NavItem, "href" | "children">) => {
      const childHrefs = item.children?.map((child) => child.href) ?? [];
      if (isItemActive(item.href, childHrefs)) return true;
      return childHrefs.some((href) => isItemActive(href, childHrefs));
    },
    [isItemActive],
  );

  const filterNavItems = useCallback(
    (items: NavItem[]): VisibleNavItem[] =>
      items
        .map((item) => {
          const children = (item.children ?? []).filter(
            (child) =>
              (!child.module || isModuleEnabled(child.module)) &&
              (!child.permission || hasPermission(child.permission)),
          );
          const moduleAllowed = !item.module || isModuleEnabled(item.module);
          const showParent =
            moduleAllowed &&
            (children.length > 0 || !item.permission || hasPermission(item.permission));

          if (!showParent) return null;

          return children.length > 0 ? { ...item, children } : item;
        })
        .filter((item): item is VisibleNavItem => item !== null),
    [hasPermission, isModuleEnabled],
  );

  const visibleMainGroups = useMemo(
    () =>
      mainNavGroups
        .map((group) => ({ ...group, items: filterNavItems(group.items) }))
        .filter((group) => group.items.length > 0),
    [filterNavItems],
  );

  const visibleSettings = useMemo(
    () => filterNavItems(settingsNavItems),
    [filterNavItems],
  );

  useEffect(() => {
    if (isIconMode) return;

    setCollapsedSections((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const group of visibleMainGroups) {
        const key = `group:${group.title}`;
        const groupHasActive = group.items.some((item) => navItemIsActive(item));

        if (next[key] === undefined) {
          next[key] = !groupHasActive;
          changed = true;
        }
        if (groupHasActive && next[key]) {
          next[key] = false;
          changed = true;
        }

        for (const item of group.items) {
          if (!item.children?.length) continue;
          const subKey = `nav:${item.title}`;
          const subActive = navItemIsActive(item);
          if (next[subKey] === undefined) {
            next[subKey] = !subActive;
            changed = true;
          }
          if (subActive && next[subKey]) {
            next[subKey] = false;
            changed = true;
          }
        }
      }

      const settingsKey = "group:Settings";
      const settingsHasActive = visibleSettings.some((item) => navItemIsActive(item));
      if (next[settingsKey] === undefined) {
        next[settingsKey] = !settingsHasActive;
        changed = true;
      }
      if (settingsHasActive && next[settingsKey]) {
        next[settingsKey] = false;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [isIconMode, navItemIsActive, visibleMainGroups, visibleSettings]);

  function toggleSection(key: string) {
    setCollapsedSections((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
  }

  function renderIconLink(item: VisibleNavItem) {
    const Icon = item.icon;
    const isActive = navItemIsActive(item);

    if (item.children && item.children.length > 0) {
      return (
        <Tooltip key={item.href}>
          <DropdownMenu>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                  )}
                  aria-label={item.title}
                >
                  <Icon className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <DropdownMenuContent side="right" align="start" className="min-w-44">
              {item.children.map((child) => {
                const childHrefs = item.children!.map((c) => c.href);
                const childActive = isItemActive(child.href, childHrefs);
                return (
                  <DropdownMenuItem key={child.href} asChild>
                    <Link
                      href={child.href}
                      className={cn(childActive && "bg-accent font-medium")}
                    >
                      {child.title}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipContent side="right">{item.title}</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50",
            )}
            aria-label={item.title}
          >
            <Icon className="h-4 w-4" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    );
  }

  function renderNavItem(item: VisibleNavItem) {
    const Icon = item.icon;
    const subKey = `nav:${item.title}`;

    if (item.children && item.children.length > 0) {
      const isExpanded = !collapsedSections[subKey];
      const isActive = navItemIsActive(item);

      return (
        <div key={subKey}>
          <button
            type="button"
            onClick={() => toggleSection(subKey)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent/70 text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{item.title}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform",
                isExpanded ? "rotate-0" : "-rotate-90",
              )}
            />
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">
              {item.children.map((child) => {
                const ChildIcon = child.icon;
                const childHrefs = item.children!.map((c) => c.href);
                const childActive = isItemActive(child.href, childHrefs);

                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                      childActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                  >
                    <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                    {child.title}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const isActive = isItemActive(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {item.title}
      </Link>
    );
  }

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
            <Store className="h-4 w-4" />
          </div>
          {!isIconMode && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Mini Mart ERP</p>
              {organizationName && (
                <p className="truncate text-xs text-muted-foreground">
                  {organizationName}
                </p>
              )}
            </div>
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
              {visibleMainGroups.map((group, groupIndex) => (
                <div key={group.title} className="flex w-full flex-col items-center gap-1">
                  {groupIndex > 0 && <Separator className="my-2 w-8" />}
                  {group.items.map((item) => renderIconLink(item))}
                </div>
              ))}
              {visibleSettings.length > 0 && (
                <>
                  <Separator className="my-2 w-8" />
                  {visibleSettings.map((item) => renderIconLink(item))}
                </>
              )}
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
            <>
              {visibleMainGroups.map((group, groupIndex) => {
                const GroupIcon = group.icon;
                const groupKey = `group:${group.title}`;
                const isCollapsed = collapsedSections[groupKey];

                return (
                  <div key={group.title}>
                    {groupIndex > 0 && <Separator className="my-4" />}
                    <button
                      type="button"
                      className="mb-2 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                      onClick={() => toggleSection(groupKey)}
                      aria-expanded={!isCollapsed}
                    >
                      <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 text-left">{group.title}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-transform",
                          isCollapsed ? "-rotate-90" : "rotate-0",
                        )}
                      />
                    </button>
                    {!isCollapsed && (
                      <nav className="space-y-1">
                        {group.items.map((item) => renderNavItem(item))}
                      </nav>
                    )}
                  </div>
                );
              })}
              {visibleSettings.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <button
                    type="button"
                    className="mb-2 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                    onClick={() => toggleSection("group:Settings")}
                    aria-expanded={!collapsedSections["group:Settings"]}
                  >
                    <Settings className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 text-left">Settings</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform",
                        collapsedSections["group:Settings"] ? "-rotate-90" : "rotate-0",
                      )}
                    />
                  </button>
                  {!collapsedSections["group:Settings"] && (
                    <nav className="space-y-1">
                      {visibleSettings.map((item) => renderNavItem(item))}
                    </nav>
                  )}
                </>
              )}
            </>
          )}
        </ScrollArea>
      </aside>
    </TooltipProvider>
  );
}

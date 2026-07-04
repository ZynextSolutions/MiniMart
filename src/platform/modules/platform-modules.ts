export const PLATFORM_MODULES = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "KPI overview and charts",
    routes: ["/"],
    defaultEnabled: true,
  },
  {
    key: "pos",
    label: "POS & Cash Register",
    description: "Point of sale terminal and cash drawer",
    routes: ["/pos", "/cash-register"],
    defaultEnabled: true,
  },
  {
    key: "catalog",
    label: "Products & Catalog",
    description: "Products, categories, brands, and units",
    routes: ["/products", "/categories", "/brands", "/units"],
    defaultEnabled: true,
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Stock movements, transfers, and counts",
    routes: ["/inventory"],
    defaultEnabled: true,
  },
  {
    key: "purchasing",
    label: "Purchasing",
    description: "Purchase orders, receiving, and payables",
    routes: ["/purchasing"],
    defaultEnabled: false,
  },
  {
    key: "suppliers",
    label: "Suppliers",
    description: "Supplier directory and management",
    routes: ["/suppliers"],
    defaultEnabled: true,
  },
  {
    key: "customers",
    label: "Customers",
    description: "Customer profiles and credit",
    routes: ["/customers"],
    defaultEnabled: true,
  },
  {
    key: "accounting",
    label: "Accounting",
    description: "Chart of accounts, journal, and financial statements",
    routes: ["/accounting"],
    defaultEnabled: false,
  },
  {
    key: "reports",
    label: "Reports",
    description: "Sales, inventory, and financial reports",
    routes: ["/reports"],
    defaultEnabled: true,
  },
  {
    key: "barcode",
    label: "Barcode Labels",
    description: "Barcode generation and label designer",
    routes: ["/barcode"],
    defaultEnabled: false,
  },
  {
    key: "promotions",
    label: "Promotions",
    description: "Coupons and promotional campaigns",
    routes: ["/settings/promotions"],
    defaultEnabled: false,
  },
  {
    key: "gift_cards",
    label: "Gift Cards",
    description: "Gift card issuance and redemption",
    routes: ["/settings/gift-cards"],
    defaultEnabled: false,
  },
  {
    key: "api",
    label: "API Access",
    description: "REST API for integrations",
    routes: ["/api/v1"],
    defaultEnabled: false,
  },
  {
    key: "offline_pos",
    label: "Offline POS",
    description: "Offline checkout and sync",
    routes: [],
    defaultEnabled: false,
  },
] as const;

export type PlatformModuleKey = (typeof PLATFORM_MODULES)[number]["key"];

export const MODULE_FLAG_PREFIX = "module.";

export function moduleFlagKey(moduleKey: PlatformModuleKey): string {
  return `${MODULE_FLAG_PREFIX}${moduleKey}`;
}

export function parseModuleFlagKey(flagKey: string): PlatformModuleKey | null {
  if (!flagKey.startsWith(MODULE_FLAG_PREFIX)) return null;
  const key = flagKey.slice(MODULE_FLAG_PREFIX.length);
  return PLATFORM_MODULES.some((m) => m.key === key)
    ? (key as PlatformModuleKey)
    : null;
}

export function defaultModuleMap(
  overrides?: Partial<Record<PlatformModuleKey, boolean>>,
): Record<PlatformModuleKey, boolean> {
  return PLATFORM_MODULES.reduce(
    (acc, mod) => {
      acc[mod.key] = overrides?.[mod.key] ?? mod.defaultEnabled;
      return acc;
    },
    {} as Record<PlatformModuleKey, boolean>,
  );
}

export const STARTER_PLAN_MODULES: Partial<Record<PlatformModuleKey, boolean>> = {
  purchasing: false,
  accounting: false,
  barcode: false,
  promotions: false,
  gift_cards: false,
  api: false,
  offline_pos: false,
};

export const PROFESSIONAL_PLAN_MODULES: Partial<Record<PlatformModuleKey, boolean>> = {
  purchasing: true,
  accounting: true,
  barcode: true,
  promotions: true,
  gift_cards: true,
  api: true,
  offline_pos: false,
};

export function allModulesEnabled(): Record<PlatformModuleKey, boolean> {
  return PLATFORM_MODULES.reduce(
    (acc, mod) => {
      acc[mod.key] = true;
      return acc;
    },
    {} as Record<PlatformModuleKey, boolean>,
  );
}

export function modulesForPlanSlug(slug: string): Record<PlatformModuleKey, boolean> {
  if (slug === "professional" || slug === "pro") {
    return defaultModuleMap(PROFESSIONAL_PLAN_MODULES);
  }
  return defaultModuleMap(STARTER_PLAN_MODULES);
}

export function isRouteAllowed(
  pathname: string,
  enabledModules: Record<PlatformModuleKey, boolean>,
): boolean {
  if (pathname === "/" || pathname.startsWith("/settings") || pathname.startsWith("/notifications") || pathname.startsWith("/audit-logs")) {
    if (pathname.startsWith("/settings/promotions")) {
      return enabledModules.promotions;
    }
    if (pathname.startsWith("/settings/gift-cards")) {
      return enabledModules.gift_cards;
    }
    return true;
  }

  for (const mod of PLATFORM_MODULES) {
    if (!mod.routes.length) continue;
    const matches = mod.routes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    if (matches) return enabledModules[mod.key];
  }

  return true;
}

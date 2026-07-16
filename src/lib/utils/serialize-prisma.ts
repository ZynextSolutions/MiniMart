import {
  allModulesEnabled,
  defaultModuleMap,
  modulesForPlanSlug,
  type PlatformModuleKey,
} from "@/platform/modules/platform-modules";
import type { PlanLimits } from "@/platform/subscriptions/plan-limits.types";

/** Convert Prisma Decimal (or similar) to a plain number for Client Components. */
export function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(String(value));
}

/** Convert Prisma Decimal (or similar) to a plain string for Client Components. */
export function serializeDecimal(value: unknown): string {
  if (value == null) return "0";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value) {
    return (value as { toString(): string }).toString();
  }
  return String(value);
}

export function serializePlan<
  T extends {
    price: unknown;
    currency?: string;
    slug?: string;
    limits?: unknown;
    features?: unknown;
    createdAt?: Date;
    updatedAt?: Date;
  },
>(plan: T) {
  const limits = (plan.limits ?? {}) as PlanLimits & Record<string, number>;
  const { modules: rawModules, ...numericLimits } = limits;
  const hasConfiguredModules =
    rawModules != null && Object.keys(rawModules).length > 0;
  const modules = hasConfiguredModules
    ? defaultModuleMap(rawModules as Partial<Record<PlatformModuleKey, boolean>>)
    : allModulesEnabled();

  return {
    ...plan,
    price: serializeDecimal(plan.price),
    currency: (plan as { currency?: string }).currency ?? "MMK",
    limits: numericLimits,
    modules,
    features: (Array.isArray(plan.features) ? plan.features : []) as string[],
    ...(plan.createdAt ? { createdAt: plan.createdAt.toISOString() } : {}),
    ...(plan.updatedAt ? { updatedAt: plan.updatedAt.toISOString() } : {}),
  };
}

export function serializeOrganizationListItem<
  T extends {
    createdAt: Date;
    subscription: {
      status: string;
      plan: { name: string; price?: unknown };
    } | null;
  },
>(org: T) {
  return {
    ...org,
    createdAt: org.createdAt.toISOString(),
    subscription: org.subscription
      ? {
          status: org.subscription.status,
          plan: { name: org.subscription.plan.name },
        }
      : null,
  };
}

export function serializePromotion<
  T extends { discountValue: unknown; minPurchase?: unknown | null },
>(item: T) {
  return {
    ...item,
    discountValue: serializeDecimal(item.discountValue),
    minPurchase:
      item.minPurchase != null ? serializeDecimal(item.minPurchase) : null,
  };
}

export function serializeGiftCard<
  T extends { balance: unknown; expiresAt?: Date | null },
>(card: T) {
  return {
    ...card,
    balance: serializeDecimal(card.balance),
    expiresAt: card.expiresAt?.toISOString() ?? null,
  };
}

export function serializeDates<T extends Record<string, unknown>>(
  item: T,
  fields: (keyof T)[],
) {
  const result = { ...item };
  for (const field of fields) {
    const value = result[field];
    if (value instanceof Date) {
      result[field] = value.toISOString() as T[keyof T];
    }
  }
  return result;
}

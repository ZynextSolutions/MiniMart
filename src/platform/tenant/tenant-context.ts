import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  organizationId: string;
  enforce?: boolean;
};

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

export function getOrganizationIdFromContext(): string | undefined {
  return tenantStorage.getStore()?.organizationId;
}

export async function withOrganizationContext<T>(
  organizationId: string,
  fn: () => Promise<T>,
  options?: { enforce?: boolean },
): Promise<T> {
  return tenantStorage.run(
    { organizationId, enforce: options?.enforce ?? true },
    fn,
  );
}

export function runWithOrganizationContext<T>(
  organizationId: string,
  fn: () => T,
  options?: { enforce?: boolean },
): T {
  return tenantStorage.run(
    { organizationId, enforce: options?.enforce ?? true },
    fn,
  );
}

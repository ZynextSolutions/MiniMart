import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSION_CODES,
  PERMISSION_DEFINITIONS,
  PERMISSIONS,
} from "@/lib/permissions/permissions";
import {
  ROLE_PERMISSION_MAP,
  SYSTEM_ROLES,
} from "@/lib/permissions/roles";

describe("system role permission alignment", () => {
  it("PERMISSION_DEFINITIONS covers every PERMISSIONS code", () => {
    const defined = new Set(PERMISSION_DEFINITIONS.map((p) => p.code));
    for (const code of ALL_PERMISSION_CODES) {
      expect(defined.has(code), `missing definition for ${code}`).toBe(true);
    }
    expect(defined.size).toBe(ALL_PERMISSION_CODES.length);
  });

  it("every role permission exists in ALL_PERMISSION_CODES", () => {
    const all = new Set<string>(ALL_PERMISSION_CODES);
    for (const [role, codes] of Object.entries(ROLE_PERMISSION_MAP)) {
      for (const code of codes) {
        expect(all.has(code), `${role} has unknown permission ${code}`).toBe(
          true,
        );
      }
    }
  });

  it("Owner has every permission", () => {
    expect(new Set(ROLE_PERMISSION_MAP[SYSTEM_ROLES.OWNER])).toEqual(
      new Set(ALL_PERMISSION_CODES),
    );
  });

  it("Cashier can run core POS including limited discount", () => {
    const cashier = new Set(ROLE_PERMISSION_MAP[SYSTEM_ROLES.CASHIER]);
    expect(cashier.has(PERMISSIONS.POS.ACCESS)).toBe(true);
    expect(cashier.has(PERMISSIONS.POS.SALE_CREATE)).toBe(true);
    expect(cashier.has(PERMISSIONS.POS.SALE_DISCOUNT)).toBe(true);
    expect(cashier.has(PERMISSIONS.POS.SALE_VOID)).toBe(false);
    expect(cashier.has(PERMISSIONS.POS.SALE_DISCOUNT_UNLIMITED)).toBe(false);
  });

  it("Manager has void/unlimited discount but not role admin or user mutate", () => {
    const manager = new Set(ROLE_PERMISSION_MAP[SYSTEM_ROLES.MANAGER]);
    expect(manager.has(PERMISSIONS.POS.SALE_VOID)).toBe(true);
    expect(manager.has(PERMISSIONS.POS.SALE_DISCOUNT_UNLIMITED)).toBe(true);
    expect(manager.has(PERMISSIONS.USERS.VIEW)).toBe(true);
    expect(manager.has(PERMISSIONS.USERS.UPDATE)).toBe(false);
    expect(manager.has(PERMISSIONS.ROLES.MANAGE)).toBe(false);
    expect(manager.has(PERMISSIONS.SETTINGS.FISCAL_MANAGE)).toBe(false);
  });

  it("Warehouse can manage assortment via products.update", () => {
    const warehouse = new Set(ROLE_PERMISSION_MAP[SYSTEM_ROLES.WAREHOUSE]);
    expect(warehouse.has(PERMISSIONS.PRODUCTS.UPDATE)).toBe(true);
    expect(warehouse.has(PERMISSIONS.SETTINGS.WAREHOUSE_MANAGE)).toBe(true);
    expect(warehouse.has(PERMISSIONS.INVENTORY.TRANSFER)).toBe(true);
  });

  it("Accountant has books + audit, Viewer stays read-only", () => {
    const accountant = new Set(ROLE_PERMISSION_MAP[SYSTEM_ROLES.ACCOUNTANT]);
    const viewer = new Set(ROLE_PERMISSION_MAP[SYSTEM_ROLES.VIEWER]);
    expect(accountant.has(PERMISSIONS.ACCOUNTING.PERIOD_CLOSE)).toBe(true);
    expect(accountant.has(PERMISSIONS.AUDIT.VIEW)).toBe(true);
    expect(viewer.has(PERMISSIONS.ACCOUNTING.JOURNAL_CREATE)).toBe(false);
    expect(viewer.has(PERMISSIONS.PRODUCTS.UPDATE)).toBe(false);
  });
});

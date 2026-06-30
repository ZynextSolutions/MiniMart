import type { Permission } from "./permissions";
import { ALL_PERMISSION_CODES } from "./permissions";

export const SYSTEM_ROLES = {
  OWNER: "Owner",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  CASHIER: "Cashier",
  WAREHOUSE: "Warehouse",
  VIEWER: "Viewer",
} as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

const ownerPermissions: Permission[] = [...ALL_PERMISSION_CODES];

const managerPermissions: Permission[] = ALL_PERMISSION_CODES.filter(
  (p) =>
    ![
      "users.create",
      "users.delete",
      "roles.manage",
      "accounting.coa.manage",
      "accounting.journal.create",
      "accounting.journal.void",
      "accounting.period.close",
      "accounting.bank.reconcile",
      "settings.fiscal.manage",
    ].includes(p),
);

const accountantPermissions: Permission[] = [
  "settings.company.view",
  "settings.tax.manage",
  "products.view",
  "inventory.view",
  "inventory.ledger.view",
  "customers.view",
  "customers.credit.manage",
  "customers.statement.view",
  "suppliers.view",
  "suppliers.payment",
  "suppliers.statement.view",
  "purchasing.invoice.manage",
  "accounting.coa.view",
  "accounting.coa.manage",
  "accounting.journal.view",
  "accounting.journal.create",
  "accounting.journal.void",
  "accounting.period.close",
  "accounting.bank.manage",
  "accounting.bank.reconcile",
  "accounting.expense.create",
  "accounting.income.create",
  "cash-register.view",
  "reports.dashboard",
  "reports.sales",
  "reports.purchases",
  "reports.inventory",
  "reports.financial",
  "reports.export",
  "notifications.view",
];

const cashierPermissions: Permission[] = [
  "products.view",
  "pos.access",
  "pos.sale.create",
  "pos.sale.hold",
  "pos.sale.return",
  "pos.sale.exchange",
  "pos.receipt.reprint",
  "pos.coupon.apply",
  "pos.gift-card.redeem",
  "cash-register.open",
  "cash-register.close",
  "cash-register.view",
  "customers.view",
  "customers.manage",
  "barcode.print",
  "notifications.view",
];

const warehousePermissions: Permission[] = [
  "products.view",
  "products.create",
  "products.update",
  "categories.manage",
  "brands.manage",
  "units.manage",
  "barcode.generate",
  "barcode.print",
  "inventory.view",
  "inventory.stock-in",
  "inventory.stock-out",
  "inventory.adjust",
  "inventory.transfer",
  "inventory.stock-count",
  "inventory.ledger.view",
  "settings.warehouse.manage",
  "suppliers.view",
  "suppliers.manage",
  "purchasing.request.create",
  "purchasing.order.create",
  "purchasing.receive",
  "purchasing.invoice.manage",
  "purchasing.return",
  "reports.purchases",
  "reports.inventory",
  "notifications.view",
];

const viewerPermissions: Permission[] = [
  "settings.company.view",
  "products.view",
  "inventory.view",
  "inventory.ledger.view",
  "customers.view",
  "customers.statement.view",
  "suppliers.view",
  "suppliers.statement.view",
  "accounting.coa.view",
  "accounting.journal.view",
  "cash-register.view",
  "reports.dashboard",
  "reports.sales",
  "reports.purchases",
  "reports.inventory",
  "reports.financial",
  "notifications.view",
];

export const ROLE_PERMISSION_MAP: Record<SystemRoleName, Permission[]> = {
  [SYSTEM_ROLES.OWNER]: ownerPermissions,
  [SYSTEM_ROLES.MANAGER]: managerPermissions,
  [SYSTEM_ROLES.ACCOUNTANT]: accountantPermissions,
  [SYSTEM_ROLES.CASHIER]: cashierPermissions,
  [SYSTEM_ROLES.WAREHOUSE]: warehousePermissions,
  [SYSTEM_ROLES.VIEWER]: viewerPermissions,
};

export const ROLE_DESCRIPTIONS: Record<SystemRoleName, string> = {
  [SYSTEM_ROLES.OWNER]: "Full system access",
  [SYSTEM_ROLES.MANAGER]: "Branch operations except user/role and fiscal management",
  [SYSTEM_ROLES.ACCOUNTANT]: "Accounting, reports, and financial operations",
  [SYSTEM_ROLES.CASHIER]: "POS and cash register operations",
  [SYSTEM_ROLES.WAREHOUSE]: "Inventory, purchasing, and product management",
  [SYSTEM_ROLES.VIEWER]: "Read-only access to reports and master data",
};

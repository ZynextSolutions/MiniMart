import type { Permission } from "@/lib/permissions/permissions";
import type { PlatformModuleKey } from "@/platform/modules/platform-modules";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Truck,
  Users,
  UserCircle,
  Calculator,
  BarChart3,
  Settings,
  ScanBarcode,
  ClipboardList,
  Bell,
  Store,
  Layers,
  Boxes,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  module?: PlatformModuleKey;
  badge?: string;
  children?: NavItem[];
}

export interface NavGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

export const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    permission: "reports.dashboard",
    module: "dashboard",
  },
  {
    title: "POS",
    href: "/pos",
    icon: ShoppingCart,
    permission: "pos.access",
    module: "pos",
  },
  {
    title: "Cash Register",
    href: "/cash-register",
    icon: ShoppingCart,
    permission: "cash-register.view",
    module: "pos",
  },
  {
    title: "Products",
    href: "/products",
    icon: Package,
    permission: "products.view",
    module: "catalog",
  },
  {
    title: "Categories",
    href: "/categories",
    icon: Package,
    permission: "categories.manage",
    module: "catalog",
  },
  {
    title: "Brands",
    href: "/brands",
    icon: Package,
    permission: "brands.manage",
    module: "catalog",
  },
  {
    title: "Units",
    href: "/units",
    icon: Package,
    permission: "units.manage",
    module: "catalog",
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Warehouse,
    permission: "inventory.view",
    module: "inventory",
    children: [
      { title: "Overview", href: "/inventory", icon: Warehouse, permission: "inventory.view" },
      { title: "Stock In", href: "/inventory/stock-in", icon: Warehouse, permission: "inventory.stock-in" },
      { title: "Stock Out", href: "/inventory/stock-out", icon: Warehouse, permission: "inventory.stock-out" },
      { title: "Adjustments", href: "/inventory/adjustments", icon: Warehouse, permission: "inventory.adjust" },
      { title: "Transfers", href: "/inventory/transfers", icon: Warehouse, permission: "inventory.transfer" },
      { title: "Stock Count", href: "/inventory/stock-count", icon: Warehouse, permission: "inventory.stock-count" },
      { title: "Ledger", href: "/inventory/ledger", icon: Warehouse, permission: "inventory.ledger.view" },
    ],
  },
  {
    title: "Purchasing",
    href: "/purchasing/orders",
    icon: Truck,
    permission: "purchasing.order.create",
    module: "purchasing",
    children: [
      { title: "Requests", href: "/purchasing/requests", icon: Truck, permission: "purchasing.request.create" },
      { title: "Orders", href: "/purchasing/orders", icon: Truck, permission: "purchasing.order.create" },
      { title: "Receiving", href: "/purchasing/receiving", icon: Truck, permission: "purchasing.receive" },
      { title: "Invoices", href: "/purchasing/invoices", icon: Truck, permission: "purchasing.invoice.manage" },
      { title: "Payables", href: "/purchasing/payables", icon: Truck, permission: "purchasing.invoice.manage" },
      { title: "Returns", href: "/purchasing/returns", icon: Truck, permission: "purchasing.return" },
    ],
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    icon: Store,
    permission: "suppliers.view",
    module: "suppliers",
  },
  {
    title: "Customers",
    href: "/customers",
    icon: UserCircle,
    permission: "customers.view",
    module: "customers",
  },
  {
    title: "Accounting",
    href: "/accounting/journal",
    icon: Calculator,
    permission: "accounting.journal.view",
    module: "accounting",
    children: [
      { title: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: Calculator, permission: "accounting.coa.view" },
      { title: "Journal Entries", href: "/accounting/journal", icon: Calculator, permission: "accounting.journal.view" },
      { title: "General Ledger", href: "/accounting/general-ledger", icon: Calculator, permission: "accounting.journal.view" },
      { title: "Trial Balance", href: "/accounting/trial-balance", icon: Calculator, permission: "accounting.journal.view" },
      { title: "Balance Sheet", href: "/accounting/balance-sheet", icon: Calculator, permission: "accounting.journal.view" },
      { title: "Profit & Loss", href: "/accounting/profit-loss", icon: Calculator, permission: "accounting.journal.view" },
      { title: "Cash Flow", href: "/accounting/cash-flow", icon: Calculator, permission: "accounting.journal.view" },
      { title: "Receivables", href: "/accounting/receivables", icon: Calculator, permission: "accounting.journal.view" },
      { title: "Payables Aging", href: "/accounting/payables", icon: Calculator, permission: "accounting.journal.view" },
      { title: "Expenses", href: "/accounting/expenses", icon: Calculator, permission: "accounting.expense.create" },
      { title: "Income", href: "/accounting/income", icon: Calculator, permission: "accounting.income.create" },
      { title: "Bank", href: "/accounting/bank", icon: Calculator, permission: "accounting.bank.manage" },
      { title: "Fiscal Year", href: "/accounting/fiscal-year", icon: Calculator, permission: "accounting.period.close" },
      { title: "Petty Cash", href: "/accounting/petty-cash", icon: Calculator, permission: "accounting.expense.create" },
    ],
  },
  {
    title: "Expenses",
    href: "/accounting/expenses",
    icon: Calculator,
    permission: "accounting.expense.create",
    module: "accounting",
  },
  {
    title: "Income",
    href: "/accounting/income",
    icon: Calculator,
    permission: "accounting.income.create",
    module: "accounting",
  },
  {
    title: "Reports",
    href: "/reports/sales",
    icon: BarChart3,
    permission: "reports.sales",
    module: "reports",
    children: [
      { title: "Sales", href: "/reports/sales", icon: BarChart3, permission: "reports.sales" },
      { title: "Purchases", href: "/reports/purchases", icon: BarChart3, permission: "reports.purchases" },
      { title: "Inventory", href: "/reports/inventory", icon: BarChart3, permission: "reports.inventory" },
      { title: "Profit & Analysis", href: "/reports/profit", icon: BarChart3, permission: "reports.financial" },
      { title: "Customer Statement", href: "/reports/customer-statement", icon: BarChart3, permission: "reports.financial" },
      { title: "Supplier Statement", href: "/reports/supplier-statement", icon: BarChart3, permission: "reports.financial" },
      { title: "Tax Report", href: "/reports/tax", icon: BarChart3, permission: "reports.financial" },
    ],
  },
  {
    title: "Barcode",
    href: "/barcode",
    icon: ScanBarcode,
    permission: "barcode.generate",
    module: "barcode",
    children: [
      { title: "Label Designer", href: "/barcode", icon: ScanBarcode, permission: "barcode.generate" },
    ],
  },
];

export const mainNavGroups: NavGroup[] = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    items: [mainNavItems[0]],
  },
  {
    title: "Sales",
    icon: ShoppingCart,
    items: [mainNavItems[1], mainNavItems[2], mainNavItems[10]],
  },
  {
    title: "Catalog",
    icon: Layers,
    items: [mainNavItems[3], mainNavItems[4], mainNavItems[5], mainNavItems[6], mainNavItems[15]],
  },
  {
    title: "Operations",
    icon: Boxes,
    items: [mainNavItems[7], mainNavItems[8], mainNavItems[9]],
  },
  {
    title: "Finance & Reports",
    icon: BarChart3,
    items: [mainNavItems[11], mainNavItems[14]],
  },
];

export const settingsNavItems: NavItem[] = [
  {
    title: "Company",
    href: "/settings/company",
    icon: Settings,
    permission: "settings.company.view",
  },
  {
    title: "Branches",
    href: "/settings/branches",
    icon: Store,
    permission: "settings.branch.manage",
  },
  {
    title: "Warehouses",
    href: "/settings/warehouses",
    icon: Warehouse,
    permission: "settings.warehouse.manage",
  },
  {
    title: "Assortment",
    href: "/settings/assortment",
    icon: Package,
    permission: "products.update",
  },
  {
    title: "Tax Rates",
    href: "/settings/taxes",
    icon: Calculator,
    permission: "settings.tax.manage",
  },
  {
    title: "Account Mapping",
    href: "/settings/account-mapping",
    icon: Calculator,
    permission: "settings.fiscal.manage",
  },
  {
    title: "Users",
    href: "/settings/users",
    icon: Users,
    permission: "users.view",
  },
  {
    title: "Roles",
    href: "/settings/roles",
    icon: ClipboardList,
    permission: "roles.view",
  },
  {
    title: "Billing",
    href: "/settings/billing",
    icon: Calculator,
    permission: "settings.company.view",
  },
  {
    title: "Promotions",
    href: "/settings/promotions",
    icon: ClipboardList,
    permission: "settings.company.view",
    module: "promotions",
  },
  {
    title: "Gift Cards",
    href: "/settings/gift-cards",
    icon: ClipboardList,
    permission: "customers.view",
    module: "gift_cards",
  },
  {
    title: "Audit Logs",
    href: "/audit-logs",
    icon: ClipboardList,
    permission: "audit.view",
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
    permission: "notifications.view",
  },
];

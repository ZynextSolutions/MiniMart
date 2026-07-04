import {
  AccountSubtype,
  AccountType,
} from "@prisma/client";

export const DEFAULT_CHART_OF_ACCOUNTS = [
  { code: "1000", name: "Assets", type: AccountType.ASSET, subtype: AccountSubtype.OTHER, normalBalance: "DEBIT", isSystem: true },
  { code: "1100", name: "Cash on Hand", type: AccountType.ASSET, subtype: AccountSubtype.CASH, normalBalance: "DEBIT", isSystem: true },
  { code: "1110", name: "Petty Cash", type: AccountType.ASSET, subtype: AccountSubtype.PETTY_CASH, normalBalance: "DEBIT", isSystem: true },
  { code: "1200", name: "Bank Accounts", type: AccountType.ASSET, subtype: AccountSubtype.BANK, normalBalance: "DEBIT", isSystem: true },
  { code: "1300", name: "Accounts Receivable", type: AccountType.ASSET, subtype: AccountSubtype.ACCOUNTS_RECEIVABLE, normalBalance: "DEBIT", isSystem: true },
  { code: "1400", name: "Inventory", type: AccountType.ASSET, subtype: AccountSubtype.INVENTORY, normalBalance: "DEBIT", isSystem: true },
  { code: "1500", name: "Fixed Assets", type: AccountType.ASSET, subtype: AccountSubtype.FIXED_ASSET, normalBalance: "DEBIT", isSystem: true },
  { code: "1510", name: "Accumulated Depreciation", type: AccountType.ASSET, subtype: AccountSubtype.ACCUMULATED_DEPRECIATION, normalBalance: "CREDIT", isSystem: true },
  { code: "2000", name: "Liabilities", type: AccountType.LIABILITY, subtype: AccountSubtype.OTHER, normalBalance: "CREDIT", isSystem: true },
  { code: "2100", name: "Accounts Payable", type: AccountType.LIABILITY, subtype: AccountSubtype.ACCOUNTS_PAYABLE, normalBalance: "CREDIT", isSystem: true },
  { code: "2200", name: "Sales Tax Payable", type: AccountType.LIABILITY, subtype: AccountSubtype.SALES_TAX_PAYABLE, normalBalance: "CREDIT", isSystem: true },
  { code: "2300", name: "Gift Card Liability", type: AccountType.LIABILITY, subtype: AccountSubtype.OTHER, normalBalance: "CREDIT", isSystem: true },
  { code: "3000", name: "Equity", type: AccountType.EQUITY, subtype: AccountSubtype.OTHER, normalBalance: "CREDIT", isSystem: true },
  { code: "3100", name: "Retained Earnings", type: AccountType.EQUITY, subtype: AccountSubtype.RETAINED_EARNINGS, normalBalance: "CREDIT", isSystem: true },
  { code: "4000", name: "Revenue", type: AccountType.REVENUE, subtype: AccountSubtype.OTHER, normalBalance: "CREDIT", isSystem: true },
  { code: "4100", name: "Sales Revenue", type: AccountType.REVENUE, subtype: AccountSubtype.SALES_REVENUE, normalBalance: "CREDIT", isSystem: true },
  { code: "4200", name: "Other Income", type: AccountType.REVENUE, subtype: AccountSubtype.OTHER, normalBalance: "CREDIT", isSystem: true },
  { code: "5000", name: "Expenses", type: AccountType.EXPENSE, subtype: AccountSubtype.OTHER, normalBalance: "DEBIT", isSystem: true },
  { code: "5100", name: "Cost of Goods Sold", type: AccountType.EXPENSE, subtype: AccountSubtype.COGS, normalBalance: "DEBIT", isSystem: true },
  { code: "5200", name: "Operating Expenses", type: AccountType.EXPENSE, subtype: AccountSubtype.OTHER, normalBalance: "DEBIT", isSystem: true },
] as const;

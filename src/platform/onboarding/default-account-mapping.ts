export const ACCOUNT_MAPPING_SETTING_KEY = "account_mapping";

export const ACCOUNT_MAPPING_KEYS = [
  "cash",
  "bank",
  "accountsReceivable",
  "accountsPayable",
  "inventory",
  "salesTaxPayable",
  "salesRevenue",
  "cogs",
  "giftCardLiability",
  "cardClearing",
] as const;

export type AccountMappingKey = (typeof ACCOUNT_MAPPING_KEYS)[number];

export type AccountMapping = Record<AccountMappingKey, string>;

export const DEFAULT_ACCOUNT_MAPPING: AccountMapping = {
  cash: "1100",
  bank: "1200",
  accountsReceivable: "1300",
  inventory: "1400",
  accountsPayable: "2100",
  salesTaxPayable: "2200",
  salesRevenue: "4100",
  cogs: "5100",
  giftCardLiability: "2300",
  cardClearing: "1200",
};

export const ACCOUNT_MAPPING_FIELD_LABELS: Record<
  AccountMappingKey,
  { label: string; description: string }
> = {
  cash: { label: "Cash on Hand", description: "Cash payments at POS" },
  bank: { label: "Bank", description: "QR and bank transfer payments" },
  accountsReceivable: { label: "Accounts Receivable", description: "Credit sales" },
  accountsPayable: { label: "Accounts Payable", description: "Supplier invoices and payments" },
  inventory: { label: "Inventory", description: "Stock value on purchase and sale COGS" },
  salesTaxPayable: { label: "Sales Tax Payable", description: "Tax collected on sales" },
  salesRevenue: { label: "Sales Revenue", description: "Product sales revenue" },
  cogs: { label: "Cost of Goods Sold", description: "Inventory cost on sales" },
  giftCardLiability: { label: "Gift Card Liability", description: "Gift card redemptions" },
  cardClearing: { label: "Card Clearing", description: "Card payments at POS" },
};

export function parseAccountMapping(value: unknown): AccountMapping | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const mapping = {} as AccountMapping;

  for (const key of ACCOUNT_MAPPING_KEYS) {
    const code = record[key];
    if (typeof code !== "string" || !code.trim()) return null;
    mapping[key] = code.trim();
  }

  return mapping;
}

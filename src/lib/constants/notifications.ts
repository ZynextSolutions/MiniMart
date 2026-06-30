import type { NotificationType } from "@prisma/client";

export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { label: string; description: string }
> = {
  LOW_STOCK: {
    label: "Low Stock",
    description: "Products below reorder level",
  },
  EXPIRY_WARNING: {
    label: "Expiring Products",
    description: "Batches nearing expiry date",
  },
  NEW_PURCHASE_ARRIVAL: {
    label: "New Purchase Arrivals",
    description: "Goods received from suppliers",
  },
  DAILY_SALES_SUMMARY: {
    label: "Daily Sales Summary",
    description: "End-of-day sales totals",
  },
  CASH_DRAWER_NOT_CLOSED: {
    label: "Cash Drawer Not Closed",
    description: "Open register sessions past closing time",
  },
  LARGE_DISCOUNT: {
    label: "Large Discounts",
    description: "Sales with unusually high discounts",
  },
  SUSPICIOUS_TRANSACTION: {
    label: "Suspicious Transactions",
    description: "Returns or activity that needs review",
  },
  PAYMENT_DUE: {
    label: "Payment Due",
    description: "Supplier payments coming due",
  },
  APPROVAL_REQUIRED: {
    label: "Approval Required",
    description: "Documents waiting for approval",
  },
  SYSTEM: {
    label: "System",
    description: "General system messages",
  },
};

export const NOTIFICATION_FILTER_TYPES: NotificationType[] = [
  "LOW_STOCK",
  "EXPIRY_WARNING",
  "NEW_PURCHASE_ARRIVAL",
  "DAILY_SALES_SUMMARY",
  "CASH_DRAWER_NOT_CLOSED",
  "LARGE_DISCOUNT",
  "SUSPICIOUS_TRANSACTION",
];

export const LARGE_DISCOUNT_PERCENT = 25;
export const SUSPICIOUS_DISCOUNT_PERCENT = 50;
export const SUSPICIOUS_RETURN_RATIO = 0.5;
export const CASH_DRAWER_MAX_OPEN_HOURS = 12;

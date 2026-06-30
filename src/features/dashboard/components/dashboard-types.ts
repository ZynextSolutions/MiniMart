export interface DashboardKPIs {
  todaySales: number;
  todayTransactionCount: number;
  avgTransaction: number;
  lowStockCount: number;
  expiringSoonCount: number;
  productCount: number;
  customerCount: number;
  cashInRegister: number;
  openRegisterCount: number;
}

export interface SalesTrendPoint {
  date: string;
  label: string;
  sales: number;
}

export interface TopProductPoint {
  name: string;
  fullName: string;
  sku: string;
  revenue: number;
  quantity: number;
}

export interface PaymentBreakdownPoint {
  method: string;
  label: string;
  amount: number;
  count: number;
}

export interface RecentTransaction {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  grandTotal: number;
  customerName: string;
  cashierName: string;
  paymentMethods: string[];
}

export interface LowStockAlert {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  warehouseName: string;
  quantity: number;
  reorderLevel: number;
}

export interface ExpiryWarning {
  batchId: string;
  variantId: string;
  productName: string;
  sku: string;
  batchNumber: string;
  expiryDate: string;
  remainingQty: number;
  daysUntilExpiry: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  salesTrend: SalesTrendPoint[];
  topProducts: TopProductPoint[];
  paymentBreakdown: PaymentBreakdownPoint[];
  recentTransactions: RecentTransaction[];
  lowStockAlerts: LowStockAlert[];
  expiryWarnings: ExpiryWarning[];
}

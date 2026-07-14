"use client";

import type { ReactNode } from "react";
import { KpiCards } from "./kpi-cards";
import {
  PaymentBreakdownChart,
  SalesTrendChart,
  TopProductsChart,
} from "./dashboard-charts";
import {
  ExpiryWarningsWidget,
  LowStockWidget,
  RecentTransactionsWidget,
} from "./dashboard-widgets";
import type { DashboardData } from "./dashboard-types";

interface DashboardClientProps {
  data: DashboardData;
  userName: string;
  currency: string;
  branchFilter?: ReactNode;
}

export function DashboardClient({
  data,
  userName,
  currency,
  branchFilter,
}: DashboardClientProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {userName}</p>
        </div>
        {branchFilter}
      </div>

      <KpiCards kpis={data.kpis} currency={currency} />

      <div className="grid gap-4 lg:grid-cols-3">
        <SalesTrendChart data={data.salesTrend} currency={currency} />
        <TopProductsChart data={data.topProducts} currency={currency} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PaymentBreakdownChart data={data.paymentBreakdown} currency={currency} />
        <RecentTransactionsWidget transactions={data.recentTransactions} currency={currency} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LowStockWidget alerts={data.lowStockAlerts} />
        <ExpiryWarningsWidget warnings={data.expiryWarnings} />
      </div>
    </div>
  );
}

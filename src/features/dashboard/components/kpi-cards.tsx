"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils/format";
import type { DashboardKPIs } from "./dashboard-types";

interface KpiCardsProps {
  kpis: DashboardKPIs;
  currency: string;
}

export function KpiCards({ kpis, currency }: KpiCardsProps) {
  const cards = [
    {
      title: "Today's Net Sales",
      value: formatMoney(kpis.todayNetSales, currency),
      description:
        kpis.todayTransactionCount > 0 || kpis.todayReturnCount > 0
          ? `${kpis.todayTransactionCount} sale${kpis.todayTransactionCount === 1 ? "" : "s"}, ${kpis.todayReturnCount} return${kpis.todayReturnCount === 1 ? "" : "s"}`
          : "No sales recorded today",
      icon: ShoppingCart,
      href: "/reports/sales",
    },
    {
      title: "Avg. Transaction",
      value: formatMoney(kpis.avgTransaction, currency),
      description: "Today's average ticket size",
      icon: TrendingUp,
    },
    {
      title: "Low Stock Items",
      value: String(kpis.lowStockCount),
      description: kpis.lowStockCount > 0 ? "Items at or below reorder level" : "All stock levels healthy",
      icon: Package,
      href: "/inventory",
      alert: kpis.lowStockCount > 0,
    },
    {
      title: "Expiring Soon",
      value: String(kpis.expiringSoonCount),
      description: "Batches expiring within 30 days",
      icon: AlertTriangle,
      href: "/inventory",
      alert: kpis.expiringSoonCount > 0,
    },
    {
      title: "Products",
      value: String(kpis.productCount),
      description: "Active products in catalog",
      icon: Package,
      href: "/products",
    },
    {
      title: "Cash in Register",
      value: formatMoney(kpis.cashInRegister, currency),
      description:
        kpis.openRegisterCount > 0
          ? `${kpis.openRegisterCount} open register${kpis.openRegisterCount === 1 ? "" : "s"}`
          : "No open registers",
      icon: Wallet,
      href: "/cash-register",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((kpi) => {
        const Icon = kpi.icon;
        const content = (
          <Card className={kpi.href ? "transition-colors hover:bg-muted/50" : undefined}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <Icon
                className={`h-4 w-4 ${kpi.alert ? "text-amber-600" : "text-muted-foreground"}`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${kpi.alert ? "text-amber-600" : ""}`}
              >
                {kpi.value}
              </div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        );

        return kpi.href ? (
          <Link key={kpi.title} href={kpi.href}>
            {content}
          </Link>
        ) : (
          <div key={kpi.title}>{content}</div>
        );
      })}
    </div>
  );
}

import type { Metadata } from "next";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { DashboardService } from "@/features/dashboard/services/dashboard.service";
import { DashboardClient } from "@/features/dashboard/components/dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard | Mini Mart ERP",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await authorize(session.user.id, PERMISSIONS.REPORTS.DASHBOARD);

  const filters = {
    organizationId: session.user.organizationId,
    branchId: session.user.branchId ?? undefined,
  };

  const [kpis, salesTrend, topProducts, paymentBreakdown, recentTransactions, lowStockAlerts, expiryWarnings] =
    await Promise.all([
      DashboardService.getKPIs(filters),
      DashboardService.getSalesTrend(filters),
      DashboardService.getTopProducts(filters),
      DashboardService.getPaymentBreakdown(filters),
      DashboardService.getRecentTransactions(filters),
      DashboardService.getLowStockAlerts(filters),
      DashboardService.getExpiryWarnings(filters),
    ]);

  const userName = session.user.name?.split(" ")[0] ?? "User";

  return (
    <DashboardClient
      userName={userName}
      currency={session.user.currency}
      data={{
        kpis,
        salesTrend,
        topProducts,
        paymentBreakdown,
        recentTransactions,
        lowStockAlerts,
        expiryWarnings,
      }}
    />
  );
}

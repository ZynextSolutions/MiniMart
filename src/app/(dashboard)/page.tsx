import type { Metadata } from "next";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { resolveLandingPath } from "@/lib/auth/landing-path";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { prisma } from "@/infrastructure/database/prisma";
import { DashboardService } from "@/features/dashboard/services/dashboard.service";
import { DashboardClient } from "@/features/dashboard/components/dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard | Mini Mart ERP",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canViewDashboard = session.user.permissions?.includes(
    PERMISSIONS.REPORTS.DASHBOARD,
  );
  if (!canViewDashboard) {
    const landing = resolveLandingPath(session.user.permissions);
    redirect(landing ?? "/login?error=AccessDenied");
  }

  await authorize(session.user.id, PERMISSIONS.REPORTS.DASHBOARD, {
    branchId: session.user.branchId ?? undefined,
  });

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { timezone: true },
  });

  const filters = {
    organizationId: session.user.organizationId,
    branchId: resolveSessionBranchFilter(session.user),
    timezone: org?.timezone ?? undefined,
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

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveLandingPath } from "@/lib/auth/landing-path";
import { authorizeSession, requireSession } from "@/lib/auth/session";
import { getUserBranches } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { resolveAuthorizedBranchFilter } from "@/lib/auth/branch-access";
import { prisma } from "@/infrastructure/database/prisma";
import { DashboardService } from "@/features/dashboard/services/dashboard.service";
import { DashboardClient } from "@/features/dashboard/components/dashboard-client";
import { DashboardBranchFilter } from "@/features/dashboard/components/dashboard-branch-filter";

export const metadata: Metadata = {
  title: "Dashboard | Mini Mart ERP",
};

interface DashboardPageProps {
  searchParams: Promise<{ branchId?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await requireSession();
  const params = await searchParams;

  const canViewDashboard = session.user.permissions?.includes(
    PERMISSIONS.REPORTS.DASHBOARD,
  );
  if (!canViewDashboard) {
    const landing = resolveLandingPath(session.user.permissions);
    redirect(landing ?? "/login?error=AccessDenied");
  }

  await authorizeSession(session, PERMISSIONS.REPORTS.DASHBOARD);

  const branches = await getUserBranches(session.user.id);
  const authorizedBranchIds = branches.map((branch) => branch.id);

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { timezone: true },
  });

  const filters = {
    organizationId: session.user.organizationId,
    branchId: resolveAuthorizedBranchFilter(authorizedBranchIds, params.branchId),
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
      branchFilter={
        <DashboardBranchFilter
          branches={branches.map((branch) => ({
            id: branch.id,
            name: branch.name,
          }))}
          selectedBranchId={params.branchId}
        />
      }
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

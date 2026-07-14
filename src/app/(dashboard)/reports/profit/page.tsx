import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getUserBranches } from "@/lib/permissions/authorization";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ReportService } from "@/features/reports/services/report.service";
import { AnalysisReportClient } from "@/features/reports/components/analysis-report-client";

interface Props {
  searchParams: Promise<{ view?: string; from?: string; to?: string; branchId?: string }>;
}

function parseDateStart(date: string): Date {
  return new Date(`${date}T00:00:00.000`);
}

function parseDateEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999`);
}

export default async function ProfitReportPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await authorizeSession(session, PERMISSIONS.REPORTS.FINANCIAL);

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const from = params.from ?? monthStart;
  const to = params.to ?? today;
  const view = params.view ?? "profit";

  const filters = {
    organizationId: session.user.organizationId,
    branchId: resolveSessionBranchFilter(session.user, params.branchId),
    from: parseDateStart(from),
    to: parseDateEnd(to),
  };

  const branches = await getUserBranches(session.user.id);

  const [profit, bestSelling, slowMoving, deadStock] = await Promise.all([
    view === "profit" ? ReportService.getProfitByProduct(filters) : Promise.resolve(undefined),
    view === "best" ? ReportService.getBestSelling(filters) : Promise.resolve(undefined),
    view === "slow" ? ReportService.getSlowMoving(filters) : Promise.resolve(undefined),
    view === "dead" ? ReportService.getDeadStock(filters) : Promise.resolve(undefined),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profit & Analysis</h1>
        <p className="text-muted-foreground">Margin analysis, best sellers, slow moving, and dead stock</p>
      </div>
      <AnalysisReportClient
        view={view}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        from={from}
        to={to}
        branchId={params.branchId}
        profit={profit}
        bestSelling={bestSelling}
        slowMoving={slowMoving}
        deadStock={deadStock}
      />
    </div>
  );
}

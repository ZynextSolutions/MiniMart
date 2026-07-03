import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BranchService } from "@/features/branches/services/branch.service";
import { ReportService } from "@/features/reports/services/report.service";
import { PurchasesReportClient } from "@/features/reports/components/purchases-report-client";

interface Props {
  searchParams: Promise<{ from?: string; to?: string; branchId?: string }>;
}

function parseDateStart(date: string): Date {
  return new Date(`${date}T00:00:00.000`);
}

function parseDateEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999`);
}

export default async function PurchasesReportPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await authorize(session.user.id, PERMISSIONS.REPORTS.PURCHASES);

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const from = params.from ?? monthStart;
  const to = params.to ?? today;

  const [report, branches] = await Promise.all([
    ReportService.getPurchaseSummary({
      organizationId: session.user.organizationId,
      branchId: params.branchId,
      from: parseDateStart(from),
      to: parseDateEnd(to),
    }),
    BranchService.list(session.user.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Purchase Reports</h1>
        <p className="text-muted-foreground">Purchase orders and goods receiving summary</p>
      </div>
      <PurchasesReportClient
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        from={from}
        to={to}
        branchId={params.branchId}
        report={report}
      />
    </div>
  );
}

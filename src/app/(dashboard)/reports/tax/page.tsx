import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BranchService } from "@/features/branches/services/branch.service";
import { ReportService } from "@/features/reports/services/report.service";
import { TaxReportClient } from "@/features/reports/components/tax-report-client";

interface Props {
  searchParams: Promise<{ from?: string; to?: string; branchId?: string }>;
}

function parseDateStart(date: string): Date {
  return new Date(`${date}T00:00:00.000`);
}

function parseDateEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999`);
}

export default async function TaxReportPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await authorize(session.user.id, PERMISSIONS.REPORTS.FINANCIAL);

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const from = params.from ?? monthStart;
  const to = params.to ?? today;

  const [report, branches] = await Promise.all([
    ReportService.getTaxReport({
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
        <h1 className="text-2xl font-bold tracking-tight">Tax Report</h1>
        <p className="text-muted-foreground">Output VAT from sales and input VAT from purchases</p>
      </div>
      <TaxReportClient
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        from={from}
        to={to}
        branchId={params.branchId}
        report={report}
      />
    </div>
  );
}

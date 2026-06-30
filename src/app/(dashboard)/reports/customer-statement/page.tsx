import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CustomerService } from "@/features/customers/services/customer.service";
import { ReportService } from "@/features/reports/services/report.service";
import { StatementReportClient } from "@/features/reports/components/statement-report-client";

interface Props {
  searchParams: Promise<{ customerId?: string; from?: string; to?: string }>;
}

export default async function CustomerStatementPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await authorize(session.user.id, PERMISSIONS.REPORTS.FINANCIAL);

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const from = params.from ?? monthStart;
  const to = params.to ?? today;

  const { customers } = await CustomerService.list(session.user.organizationId, { pageSize: 200 });

  const statement = params.customerId
    ? await ReportService.getCustomerStatement(params.customerId, {
        organizationId: session.user.organizationId,
        from: new Date(from),
        to: new Date(to),
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customer Statement</h1>
        <p className="text-muted-foreground">Account ledger for a customer</p>
      </div>
      <StatementReportClient
        type="customer"
        entities={customers.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
        selectedId={params.customerId}
        from={from}
        to={to}
        statement={statement}
      />
    </div>
  );
}

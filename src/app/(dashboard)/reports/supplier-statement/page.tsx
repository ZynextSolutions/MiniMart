import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { ReportService } from "@/features/reports/services/report.service";
import { StatementReportClient } from "@/features/reports/components/statement-report-client";

interface Props {
  searchParams: Promise<{ supplierId?: string; from?: string; to?: string }>;
}

export default async function SupplierStatementPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await authorize(session.user.id, PERMISSIONS.REPORTS.FINANCIAL);

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const from = params.from ?? monthStart;
  const to = params.to ?? today;

  const { suppliers } = await SupplierService.list(session.user.organizationId, { pageSize: 200 });

  const statement = params.supplierId
    ? await ReportService.getSupplierStatement(params.supplierId, {
        organizationId: session.user.organizationId,
        from: new Date(from),
        to: new Date(to),
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Supplier Statement</h1>
        <p className="text-muted-foreground">Account ledger for a supplier</p>
      </div>
      <StatementReportClient
        type="supplier"
        entities={suppliers.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
        selectedId={params.supplierId}
        from={from}
        to={to}
        statement={statement}
      />
    </div>
  );
}

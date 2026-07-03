import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BranchService } from "@/features/branches/services/branch.service";
import { ReportService } from "@/features/reports/services/report.service";
import { SalesReportClient } from "@/features/reports/components/sales-report-client";

interface Props {
  searchParams: Promise<{
    view?: string;
    from?: string;
    to?: string;
    branchId?: string;
    query?: string;
    paymentMethod?: string;
  }>;
}

function parseDateStart(date: string): Date {
  return new Date(`${date}T00:00:00.000`);
}

function parseDateEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999`);
}

export default async function SalesReportPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await authorize(session.user.id, PERMISSIONS.REPORTS.SALES);

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const from = params.from ?? monthStart;
  const to = params.to ?? today;
  const view = params.view ?? "daily";
  const query = params.query ?? "";
  const paymentMethod = params.paymentMethod ?? "";

  if (
    view === "invoices" &&
    session.user.permissions?.includes(PERMISSIONS.REPORTS.SALES_INVOICE_LIST)
  ) {
    await authorize(session.user.id, PERMISSIONS.REPORTS.SALES_INVOICE_LIST);
  }
  if (
    view === "returns" &&
    session.user.permissions?.includes(PERMISSIONS.REPORTS.SALES_RETURN_LIST)
  ) {
    await authorize(session.user.id, PERMISSIONS.REPORTS.SALES_RETURN_LIST);
  }

  const filters = {
    organizationId: session.user.organizationId,
    branchId: params.branchId,
    from: parseDateStart(from),
    to: parseDateEnd(to),
  };

  const branches = await BranchService.list(session.user.organizationId);

  const [summary, dailySales, byProduct, byCategory, byCashier, byPayment, invoiceList, returnList] =
    await Promise.all([
      ReportService.getSalesNetSummary(filters),
    view === "daily" ? ReportService.getDailySales(filters) : Promise.resolve(undefined),
    view === "product" ? ReportService.getSalesByProduct(filters) : Promise.resolve(undefined),
    view === "category" ? ReportService.getSalesByCategory(filters) : Promise.resolve(undefined),
    view === "cashier" ? ReportService.getSalesByCashier(filters) : Promise.resolve(undefined),
    view === "payment" ? ReportService.getSalesByPaymentMethod(filters) : Promise.resolve(undefined),
      view === "invoices"
        ? ReportService.getSalesInvoiceList(filters, { query, paymentMethod })
        : Promise.resolve(undefined),
      view === "returns"
        ? ReportService.getReturnList(filters, { query, paymentMethod })
        : Promise.resolve(undefined),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sales Reports</h1>
        <p className="text-muted-foreground">Daily sales, product, category, cashier, and payment breakdowns</p>
      </div>
      <SalesReportClient
        view={view}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        from={from}
        to={to}
        branchId={params.branchId}
        query={query}
        paymentMethod={paymentMethod}
        summary={summary}
        dailySales={dailySales}
        byProduct={byProduct}
        byCategory={byCategory}
        byCashier={byCashier}
        byPayment={byPayment}
        invoiceList={invoiceList}
        returnList={returnList}
      />
    </div>
  );
}

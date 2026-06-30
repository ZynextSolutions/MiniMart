import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ReportService } from "@/features/reports/services/report.service";
import {
  InventoryReportClient,
} from "@/features/reports/components/inventory-report-client";
import {
  mapStockRows,
  mapValuationRows,
} from "@/features/reports/utils/inventory-report.mappers";
import { formatMoney } from "@/lib/utils/format";

interface Props {
  searchParams: Promise<{ view?: string; from?: string; to?: string }>;
}

export default async function InventoryReportPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await authorize(session.user.id, PERMISSIONS.REPORTS.INVENTORY);

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const from = params.from ?? monthStart;
  const to = params.to ?? today;
  const view = params.view ?? "stock";

  const orgId = session.user.organizationId;
  const dateFilters = { organizationId: orgId, from: new Date(from), to: new Date(to) };

  const [stock, valuation, movement] = await Promise.all([
    view === "stock" ? ReportService.getStockOnHand({ ...dateFilters, pageSize: 100 }) : Promise.resolve(null),
    view === "valuation" ? ReportService.getInventoryValuation(dateFilters) : Promise.resolve(null),
    view === "movement" ? ReportService.getInventoryMovement(dateFilters) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory Reports</h1>
        <p className="text-muted-foreground">Stock levels, valuation, and movement history</p>
      </div>
      <InventoryReportClient
        view={view}
        from={from}
        to={to}
        stockRows={stock ? mapStockRows(stock.levels, session.user.currency) : undefined}
        valuationRows={
          valuation ? mapValuationRows(valuation.rows, session.user.currency) : undefined
        }
        valuationTotal={valuation?.totalValue}
        movementRows={movement?.rows.map((r) => ({
          movementNumber: r.movementNumber,
          movementType: r.movementType,
          movementDate: new Date(r.movementDate).toLocaleDateString(),
          warehouseName: r.warehouseName,
          totalCost: formatMoney(r.totalCost, session.user.currency),
        }))}
      />
    </div>
  );
}

import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AccountingQueryService } from "@/features/accounting/services/accounting-query.service";
import { ProfitLossClient } from "@/features/accounting/components/profit-loss-client";

interface Props {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function ProfitLossPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.ACCOUNTING.JOURNAL_VIEW);

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const from = params.from ?? yearStart;
  const to = params.to ?? today;

  const report = await AccountingQueryService.getProfitAndLoss(
    session.user.organizationId,
    new Date(from),
    new Date(to),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profit & Loss</h1>
        <p className="text-muted-foreground">Revenue and expenses for the period</p>
      </div>
      <ProfitLossClient {...report} from={from} to={to} />
    </div>
  );
}

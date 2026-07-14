import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { InventoryQueryService } from "@/features/inventory/services/inventory-query.service";
import { StockCountDetailClient } from "@/features/inventory/components/stock-count-detail-client";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default async function StockCountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.INVENTORY.STOCK_COUNT);

  const { id } = await params;
  const stockCount = await InventoryQueryService.getStockCount(id, session.user.organizationId);

  if (!stockCount) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inventory/stock-count">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{stockCount.countNumber}</h1>
          <p className="text-muted-foreground">Stock count detail</p>
        </div>
      </div>
      <StockCountDetailClient
        stockCount={{
          id: stockCount.id,
          countNumber: stockCount.countNumber,
          countDate: stockCount.countDate,
          status: stockCount.status,
          warehouse: stockCount.warehouse,
          lines: stockCount.lines,
        }}
      />
    </div>
  );
}

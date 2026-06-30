import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/infrastructure/database/prisma";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { WarehousesPageClient } from "@/features/warehouses/components/warehouses-page-client";

export default async function WarehousesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.SETTINGS.WAREHOUSE_MANAGE);

  const [warehouses, branches] = await Promise.all([
    WarehouseService.list(session.user.organizationId),
    prisma.branch.findMany({
      where: {
        organizationId: session.user.organizationId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <WarehousesPageClient
      initialWarehouses={warehouses}
      branches={branches}
    />
  );
}

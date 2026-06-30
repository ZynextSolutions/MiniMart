import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { UnitService } from "@/features/units/services/unit.service";
import { UnitsPageClient } from "@/features/units/components/units-page-client";

export default async function UnitsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.UNITS.MANAGE);

  const units = await UnitService.list(session.user.organizationId);

  return <UnitsPageClient initialUnits={units} />;
}

import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import { PlansManager } from "@/platform/admin/components/plans-manager";
import { serializePlan } from "@/lib/utils/serialize-prisma";

export default async function PlatformPlansPage() {
  const plans = await PlatformAdminService.listPlans();
  const serializedPlans = plans.map(serializePlan);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
        <p className="text-muted-foreground">
          Configure subscription plans, usage limits, and included modules.
        </p>
      </div>
      <PlansManager plans={serializedPlans} />
    </div>
  );
}

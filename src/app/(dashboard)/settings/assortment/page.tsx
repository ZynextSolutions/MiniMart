import { requireSession } from "@/lib/auth/session";
import { requireAuthorizedBranchId } from "@/lib/auth/branch-access";
import {
  authorize,
  getUserBranches,
} from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AssortmentService } from "@/features/products/services/assortment.service";
import { AssortmentPageClient } from "@/features/products/components/assortment-page-client";

export default async function AssortmentSettingsPage() {
  const session = await requireSession();
  // Page entry: any branch assignment with products.update.
  // Mutations/reads still authorize against the selected branchId.
  await authorize(session.user.id, PERMISSIONS.PRODUCTS.UPDATE);

  const branches = await getUserBranches(session.user.id);
  const initialBranchId =
    branches.find((b) => b.id === session.user.branchId)?.id ??
    branches[0]?.id;

  if (!initialBranchId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Branch assortment</h1>
        <p className="text-muted-foreground">
          Create a branch before managing assortment.
        </p>
      </div>
    );
  }

  await requireAuthorizedBranchId(session.user.branchIds, initialBranchId);
  await authorize(session.user.id, PERMISSIONS.PRODUCTS.UPDATE, {
    branchId: initialBranchId,
  });

  const initialCatalogue = await AssortmentService.listCatalogue(
    session.user.organizationId,
    initialBranchId,
  );

  return (
    <AssortmentPageClient
      branches={branches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
      }))}
      initialBranchId={initialBranchId}
      initialCatalogue={initialCatalogue}
    />
  );
}

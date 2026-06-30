import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BranchService } from "@/features/branches/services/branch.service";
import { BranchesPageClient } from "@/features/branches/components/branches-page-client";

export default async function BranchesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.SETTINGS.BRANCH_MANAGE);

  const branches = await BranchService.list(session.user.organizationId);

  return <BranchesPageClient initialBranches={branches} />;
}

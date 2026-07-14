import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BranchService } from "@/features/branches/services/branch.service";
import { BranchesPageClient } from "@/features/branches/components/branches-page-client";

export default async function BranchesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.SETTINGS.BRANCH_MANAGE);

  const branches = await BranchService.list(session.user.organizationId);

  return <BranchesPageClient initialBranches={branches} />;
}

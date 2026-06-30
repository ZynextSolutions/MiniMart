import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CategoryService } from "@/features/categories/services/category.service";
import { CategoriesPageClient } from "@/features/categories/components/categories-page-client";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.CATEGORIES.MANAGE);

  const [categories, parentOptions] = await Promise.all([
    CategoryService.list(session.user.organizationId),
    CategoryService.listFlat(session.user.organizationId),
  ]);

  return (
    <CategoriesPageClient
      initialCategories={categories}
      parentOptions={parentOptions}
    />
  );
}

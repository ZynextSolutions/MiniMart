import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BrandService } from "@/features/brands/services/brand.service";
import { BrandsPageClient } from "@/features/brands/components/brands-page-client";

export default async function BrandsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.BRANDS.MANAGE);

  const brands = await BrandService.list(session.user.organizationId);

  return <BrandsPageClient initialBrands={brands} />;
}

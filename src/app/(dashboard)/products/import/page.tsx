import { auth } from "@/lib/auth/auth";
import { authorizeSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CategoryService } from "@/features/categories/services/category.service";
import { BrandService } from "@/features/brands/services/brand.service";
import { UnitService } from "@/features/units/services/unit.service";
import { ProductImportClient } from "@/features/products/components/product-import-client";

export default async function ImportProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorizeSession(session, PERMISSIONS.PRODUCTS.CREATE);

  const orgId = session.user.organizationId;

  const [categories, brands, units] = await Promise.all([
    CategoryService.listFlat(orgId),
    BrandService.list(orgId),
    UnitService.list(orgId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Products</h1>
        <p className="text-muted-foreground">
          Add many products at once from a CSV or Excel file
        </p>
      </div>
      <ProductImportClient
        units={units.map((unit) => ({
          name: unit.name,
          abbreviation: unit.abbreviation,
        }))}
        categories={categories.map((category) => ({ name: category.name }))}
        brands={brands.map((brand) => ({ name: brand.name }))}
      />
    </div>
  );
}

import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CategoryService } from "@/features/categories/services/category.service";
import { BrandService } from "@/features/brands/services/brand.service";
import { UnitService } from "@/features/units/services/unit.service";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { TaxRateService } from "@/features/tax-rates/services/tax-rate.service";
import { ProductForm } from "@/features/products/components/product-form";

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.PRODUCTS.CREATE);

  const orgId = session.user.organizationId;

  const [categories, brands, units, suppliersResult, taxRates] = await Promise.all([
    CategoryService.listFlat(orgId),
    BrandService.list(orgId),
    UnitService.list(orgId),
    SupplierService.list(orgId, { pageSize: 100 }),
    TaxRateService.list(orgId),
  ]);

  const suppliers = suppliersResult.suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    code: supplier.code,
  }));

  const serializedTaxRates = taxRates.map((taxRate) => ({
    id: taxRate.id,
    name: taxRate.name,
    rate: taxRate.rate.toString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Product</h1>
        <p className="text-muted-foreground">Add a product to your catalog</p>
      </div>
      <ProductForm
        categories={categories}
        brands={brands}
        units={units}
        suppliers={suppliers}
        taxRates={serializedTaxRates}
      />
    </div>
  );
}

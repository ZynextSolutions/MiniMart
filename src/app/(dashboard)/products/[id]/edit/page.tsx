import { auth } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ProductService } from "@/features/products/services/product.service";
import { CategoryService } from "@/features/categories/services/category.service";
import { BrandService } from "@/features/brands/services/brand.service";
import { UnitService } from "@/features/units/services/unit.service";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { TaxRateService } from "@/features/tax-rates/services/tax-rate.service";
import { ProductForm } from "@/features/products/components/product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.PRODUCTS.UPDATE);

  const { id } = await params;
  const orgId = session.user.organizationId;

  try {
    const [product, categories, brands, units, suppliersResult, taxRates] =
      await Promise.all([
        ProductService.getById(id, orgId),
        CategoryService.listFlat(orgId),
        BrandService.list(orgId),
        UnitService.list(orgId),
        SupplierService.list(orgId, { pageSize: 100 }),
        TaxRateService.list(orgId),
      ]);

    const serializedProduct = {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      brandId: product.brandId,
      unitId: product.unitId,
      supplierId: product.supplierId,
      taxRateId: product.taxRateId,
      costPrice: product.costPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      wholesalePrice: product.wholesalePrice?.toString() ?? null,
      minStock: product.minStock.toString(),
      reorderLevel: product.reorderLevel.toString(),
      trackBatch: product.trackBatch,
      trackExpiry: product.trackExpiry,
      isActive: product.isActive,
      barcodes: product.barcodes.map((barcode) => ({ code: barcode.code })),
      images: product.images.map((image) => ({ url: image.url })),
    };

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
          <h1 className="text-2xl font-bold tracking-tight">Edit Product</h1>
          <p className="text-muted-foreground">{product.name}</p>
        </div>
        <ProductForm
          product={serializedProduct}
          categories={categories}
          brands={brands}
          units={units}
          suppliers={suppliers}
          taxRates={serializedTaxRates}
        />
      </div>
    );
  } catch {
    notFound();
  }
}

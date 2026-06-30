import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ProductService } from "@/features/products/services/product.service";
import { CategoryService } from "@/features/categories/services/category.service";
import { BrandService } from "@/features/brands/services/brand.service";
import { ProductsPageClient } from "@/features/products/components/products-page-client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.PRODUCTS.VIEW);

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const search = params.search;

  const [result, categories, brands] = await Promise.all([
    ProductService.list({
      organizationId: session.user.organizationId,
      page,
      search,
    }),
    CategoryService.listFlat(session.user.organizationId),
    BrandService.list(session.user.organizationId),
  ]);

  const products = result.products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    sellingPrice: product.sellingPrice.toString(),
    isActive: product.isActive,
    category: product.category,
    brand: product.brand,
    unit: product.unit,
    images: product.images,
    barcodes: product.barcodes,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">{result.total} products</p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </div>
      <ProductsPageClient
        products={products}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        categories={categories}
        brands={brands}
        initialSearch={search ?? ""}
      />
    </div>
  );
}

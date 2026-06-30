import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { ProductService } from "@/features/products/services/product.service";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { apiErrorResponse } from "@/lib/auth/api-error-response";
import { enforceApiRateLimit } from "@/lib/rate-limit";
import { normalizeTaxRatePercent } from "@/lib/utils/tax";

export async function GET(request: Request) {
  try {
    await enforceApiRateLimit(request, "products-search", 180);
    const session = await requireApiSession(PERMISSIONS.PRODUCTS.VIEW);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

    const products = await ProductService.search(
      session.user.organizationId,
      q,
      limit,
    );

    return NextResponse.json(
      products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        sellingPrice: p.sellingPrice.toString(),
        unit: p.unit.abbreviation,
        imageUrl: p.images[0]?.url ?? null,
        barcode: p.barcodes[0]?.code ?? p.variants[0]?.barcodes[0]?.code ?? null,
        variantId: p.variants[0]?.id ?? null,
        taxRate: p.taxRate
          ? String(normalizeTaxRatePercent(Number(p.taxRate.rate)))
          : null,
      })),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

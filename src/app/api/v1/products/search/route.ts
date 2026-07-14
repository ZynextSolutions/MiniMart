import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { ProductService } from "@/features/products/services/product.service";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { apiErrorResponse } from "@/lib/auth/api-error-response";
import { enforceApiRateLimit } from "@/lib/rate-limit";
import { normalizeTaxRatePercent } from "@/lib/utils/tax";
import { assertWarehouseAccess } from "@/lib/services/variant-access";
import { ValidationError } from "@/lib/errors/app-error";

export async function GET(request: Request) {
  try {
    await enforceApiRateLimit(request, "products-search", 180);
    const session = await requireApiSession({
      permission: PERMISSIONS.PRODUCTS.VIEW,
    });

    if (!session.user.branchId) {
      throw new ValidationError("No branch selected");
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
    const warehouseIdParam = searchParams.get("warehouseId") ?? undefined;
    const inStockOnly = searchParams.get("inStockOnly") === "1";

    let warehouseId = warehouseIdParam;
    if (warehouseId) {
      await assertWarehouseAccess(session.user.organizationId, warehouseId, {
        branchId: session.user.branchId,
      });
    }

    const branchId = session.user.branchId;
    const products = await ProductService.search(
      session.user.organizationId,
      q,
      { limit, warehouseId, inStockOnly, branchId },
    );

    return NextResponse.json(
      products.map((p) => {
        const variant = p.variants[0];
        const stockQty = warehouseId
          ? Number(variant?.stockLevels[0]?.quantity ?? 0)
          : null;

        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          sellingPrice: String(p.effectiveSellingPrice),
          unit: p.unit.abbreviation,
          imageUrl: p.images[0]?.url ?? null,
          barcode: p.barcodes[0]?.code ?? variant?.barcodes[0]?.code ?? null,
          variantId: variant?.id ?? null,
          taxRate: p.taxRate
            ? String(normalizeTaxRatePercent(Number(p.taxRate.rate)))
            : null,
          stockQty,
        };
      }),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

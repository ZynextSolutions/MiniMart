"use server";

import { requireSession, authorizeSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BarcodeService } from "@/lib/services/barcode-service";
import { BarcodeImageService } from "@/lib/services/barcode-image-service";
import { BarcodeQueryService } from "@/features/barcode/services/barcode-query.service";
import { getErrorMessage } from "@/lib/errors/app-error";

export async function searchProductsForLabelsAction(search?: string) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.BARCODE.GENERATE);

  const products = await BarcodeQueryService.listProductsForLabels(
    session.user.organizationId,
    search,
  );

  return products.map((p) => {
    const bc = p.barcodes[0] ?? p.variants[0]?.barcodes[0];
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      price: Number(p.sellingPrice),
      barcode: bc?.code ?? p.sku,
      barcodeType: (bc?.type ?? "CODE128") as string,
    };
  });
}

export async function generateBarcodeCodeAction(
  type: "INTERNAL" | "EAN13" | "CODE128",
  value?: string,
) {
  try {
    const session = await requireSession();
    await authorizeSession(session, PERMISSIONS.BARCODE.GENERATE);

    if (type === "EAN13") {
      const code = value
        ? value.length === 12
          ? value + BarcodeService.computeEAN13CheckDigit(value)
          : value
        : await BarcodeService.generateEAN13();
      if (!BarcodeService.validateEAN13(code)) {
        return { success: false, error: "Invalid EAN13 code" };
      }
      return { success: true, code, format: "EAN13" as const };
    }

    if (type === "CODE128") {
      const code = value ?? (await BarcodeService.generateInternalCode(session.user.organizationId));
      if (!BarcodeService.validateCode128(code)) {
        return { success: false, error: "Invalid Code128 value" };
      }
      return { success: true, code, format: "CODE128" as const };
    }

    const code = await BarcodeService.generateInternalCode(session.user.organizationId);
    return { success: true, code, format: "CODE128" as const };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function generateQrDataUrlAction(data: string) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.BARCODE.GENERATE);
  const result = await BarcodeImageService.generateQR(data);
  return result.dataUrl ?? "";
}

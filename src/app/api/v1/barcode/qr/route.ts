import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BarcodeImageService } from "@/lib/services/barcode-image-service";
import { apiErrorResponse } from "@/lib/auth/api-error-response";
import { enforceApiRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    await enforceApiRateLimit(request, "barcode-qr", 120);
    await requireApiSession(PERMISSIONS.BARCODE.GENERATE);

    const data = request.nextUrl.searchParams.get("data");
    const size = parseInt(request.nextUrl.searchParams.get("size") ?? "200", 10);

    if (!data) {
      return NextResponse.json({ error: "Missing data parameter" }, { status: 400 });
    }

    const result = await BarcodeImageService.generateQR(data, size);
    return NextResponse.json({ dataUrl: result.dataUrl });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

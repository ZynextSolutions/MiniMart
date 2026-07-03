import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { prisma } from "@/infrastructure/database/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { apiErrorResponse } from "@/lib/auth/api-error-response";
import { enforceApiRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    await enforceApiRateLimit(request, "pos-sales", 120);
    const session = await requireApiSession(PERMISSIONS.POS.SALE_RETURN);

    const { searchParams } = new URL(request.url);
    const invoice = searchParams.get("invoice");
    if (!invoice) {
      return NextResponse.json({ error: "Invoice required" }, { status: 400 });
    }

    const sale = await prisma.sale.findFirst({
      where: {
        organizationId: session.user.organizationId,
        invoiceNumber: invoice,
        deletedAt: null,
        saleType: "SALE",
        status: "COMPLETED",
      },
      include: { lines: true, payments: true },
    });

    if (!sale) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

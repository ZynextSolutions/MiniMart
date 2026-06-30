import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/infrastructure/database/prisma";
import { PosService } from "@/lib/services/pos-service";
import { ReceiptService } from "@/lib/services/receipt-service";
import { TaxSettingsService } from "@/lib/services/tax-settings-service";
import { apiErrorResponse } from "@/lib/auth/api-error-response";
import { enforceApiRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    await enforceApiRateLimit(request, "receipt-escpos", 60);
    const session = await requireApiSession(PERMISSIONS.POS.RECEIPT_REPRINT);

    const saleId = request.nextUrl.searchParams.get("saleId");
    const width = request.nextUrl.searchParams.get("width") === "58" ? "58" : "80";
    const kickDrawer = request.nextUrl.searchParams.get("drawer") === "1";

    if (!saleId) {
      return NextResponse.json({ error: "Missing saleId" }, { status: 400 });
    }

    const sale = await PosService.getSale(saleId, session.user.organizationId);
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
    });
    const taxMode = await TaxSettingsService.getTaxMode(session.user.organizationId);

    const baseUrl =
      process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const receiptData = {
      companyName: org?.name ?? "Mini Mart",
      companyAddress: org?.address ?? undefined,
      companyPhone: org?.phone ?? undefined,
      taxId: org?.taxId ?? undefined,
      logoUrl: org?.logoUrl ?? undefined,
      currency: org?.currency ?? session.user.currency,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate,
      cashierName: `${sale.cashier.firstName} ${sale.cashier.lastName}`,
      customerName: sale.customer?.name,
      lines: sale.lines.map((l) => ({
        productName: l.productName,
        sku: l.sku,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountAmount: Number(l.discountAmount),
        lineTotal:
          taxMode === "INCLUSIVE"
            ? Number(l.lineTotal)
            : Number(l.lineTotal) - Number(l.taxAmount),
      })),
      subtotal: Number(sale.subtotal),
      discountAmount: Number(sale.discountAmount),
      taxAmount: Number(sale.taxAmount),
      grandTotal: Number(sale.grandTotal),
      amountPaid: Number(sale.amountPaid),
      changeAmount: Number(sale.changeAmount),
      payments: sale.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        reference: p.reference ?? undefined,
      })),
      taxMode,
      verificationUrl: ReceiptService.getVerificationUrl(baseUrl, sale.invoiceNumber),
    };

    let bytes = ReceiptService.generateEscPos(receiptData, {
      width: width as "58" | "80",
    });

    if (kickDrawer) {
      const drawer = ReceiptService.generateCashDrawerKick();
      const combined = new Uint8Array(bytes.length + drawer.length);
      combined.set(bytes);
      combined.set(drawer, bytes.length);
      bytes = combined;
    }

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="receipt-${sale.invoiceNumber}.bin"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

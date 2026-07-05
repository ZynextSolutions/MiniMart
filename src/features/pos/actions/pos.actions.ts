"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBranchSession, authorizeSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getErrorMessage, ForbiddenError, ValidationError } from "@/lib/errors/app-error";
import { PosService } from "@/lib/services/pos-service";
import { CashRegisterService } from "@/lib/services/cash-register-service";
import { ReceiptService } from "@/lib/services/receipt-service";
import { TaxSettingsService } from "@/lib/services/tax-settings-service";
import { prisma } from "@/infrastructure/database/prisma";

const discountSchema = z
  .object({
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.number().nonnegative(),
  })
  .nullable()
  .optional();

const lineSchema = z.object({
  variantId: z.string().uuid(),
  productName: z.string(),
  sku: z.string(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().positive(),
  taxRateId: z.string().uuid().optional(),
  taxRate: z.number().nonnegative(),
  lineDiscount: discountSchema,
  costPrice: z.number().nonnegative().optional(),
});

const paymentSchema = z.object({
  method: z.enum([
    "CASH",
    "CARD",
    "QR",
    "BANK_TRANSFER",
    "GIFT_CARD",
    "LOYALTY_POINTS",
    "MIXED",
    "CREDIT",
  ]),
  amount: z.number().positive(),
  reference: z.string().optional(),
});

const completeSaleSchema = z.object({
  warehouseId: z.string().uuid(),
  sessionId: z.string().uuid(),
  cashRegisterId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  couponCode: z.string().optional(),
  orderDiscount: discountSchema,
  lines: z.array(lineSchema).min(1),
  payments: z.array(paymentSchema).min(1),
  cashReceived: z.number().nonnegative().optional(),
  idempotencyKey: z.string().optional(),
  notes: z.string().optional(),
});

const MAX_STANDARD_DISCOUNT_PERCENT = 50;

async function assertDiscountPermissions(
  userId: string,
  branchId: string,
  lines: z.infer<typeof lineSchema>[],
  orderDiscount: z.infer<typeof discountSchema>,
) {
  const hasLineDiscount = lines.some((l) => l.lineDiscount && l.lineDiscount.value > 0);
  const hasOrderDiscount = Boolean(orderDiscount && orderDiscount.value > 0);

  if (!hasLineDiscount && !hasOrderDiscount) return;

  const context = { branchId };
  const hasDiscountPermission = await can(
    userId,
    PERMISSIONS.POS.SALE_DISCOUNT,
    context,
  );
  if (!hasDiscountPermission) {
    throw new ForbiddenError(PERMISSIONS.POS.SALE_DISCOUNT);
  }

  const unlimited = await can(
    userId,
    PERMISSIONS.POS.SALE_DISCOUNT_UNLIMITED,
    context,
  );
  const checkDiscount = (discount: { type: "PERCENT" | "FIXED"; value: number }) => {
    if (unlimited) return;
    if (discount.type === "PERCENT" && discount.value > MAX_STANDARD_DISCOUNT_PERCENT) {
      throw new ValidationError(
        `Discount cannot exceed ${MAX_STANDARD_DISCOUNT_PERCENT}% without unlimited permission`,
      );
    }
  };

  if (orderDiscount && orderDiscount.value > 0) checkDiscount(orderDiscount);
  for (const line of lines) {
    if (line.lineDiscount && line.lineDiscount.value > 0) {
      checkDiscount(line.lineDiscount);
    }
  }
}

export async function lookupBarcodeAction(code: string) {
  const session = await requireBranchSession(PERMISSIONS.POS.ACCESS);
  const normalizedCode = code.trim();
  if (!normalizedCode) return null;
  return PosService.lookupByBarcode(session.user.organizationId, normalizedCode);
}

export async function validateCouponAction(code: string, subtotal: number) {
  try {
    const session = await requireBranchSession(PERMISSIONS.POS.COUPON_APPLY);
    const result = await PosService.validateCoupon(
      session.user.organizationId,
      code,
      subtotal,
    );
    return { success: true, discountAmount: result.discountAmount };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function validateGiftCardAction(code: string, amount: number) {
  try {
    const session = await requireBranchSession(PERMISSIONS.POS.GIFT_CARD_REDEEM);
    const card = await PosService.validateGiftCard(
      session.user.organizationId,
      code,
      amount,
    );
    return { success: true, balance: Number(card.balance) };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function completeSaleAction(input: z.infer<typeof completeSaleSchema>) {
  try {
    const session = await requireBranchSession(PERMISSIONS.POS.SALE_CREATE);
    const data = completeSaleSchema.parse(input);

    if (data.couponCode) {
      await authorizeSession(session, PERMISSIONS.POS.COUPON_APPLY);
    }
    if (data.payments.some((p) => p.method === "GIFT_CARD")) {
      await authorizeSession(session, PERMISSIONS.POS.GIFT_CARD_REDEEM);
    }

    await assertDiscountPermissions(
      session.user.id,
      session.user.branchId!,
      data.lines,
      data.orderDiscount,
    );

    const sale = await PosService.completeSale({
      ...data,
      organizationId: session.user.organizationId,
      branchId: session.user.branchId!,
      userId: session.user.id,
    });

    revalidatePath("/pos");
    return { success: true, saleId: sale.id };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

const holdCartSchema = z.object({
  items: z.array(z.object({ variantId: z.string().uuid() })).min(1),
  customerId: z.string().uuid().nullable().optional(),
});

export async function holdSaleAction(cartData: object) {
  try {
    const session = await requireBranchSession(PERMISSIONS.POS.SALE_HOLD);
    const parsed = holdCartSchema.parse(cartData);
    const hold = await PosService.holdSale(
      session.user.organizationId,
      session.user.branchId!,
      session.user.id,
      cartData,
      parsed.customerId ?? undefined,
    );
    return { success: true, hold };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function listHoldsAction() {
  const session = await requireBranchSession(PERMISSIONS.POS.SALE_HOLD);
  return PosService.listHolds(session.user.organizationId, session.user.branchId!);
}

export async function deleteHoldAction(id: string) {
  try {
    const session = await requireBranchSession(PERMISSIONS.POS.SALE_HOLD);
    await PosService.deleteHold(id, session.user.organizationId, session.user.branchId!);
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function getSaleAction(id: string) {
  const session = await requireBranchSession(PERMISSIONS.POS.ACCESS);
  return PosService.getSale(id, session.user.organizationId);
}

export async function getReceiptHtmlAction(saleId: string, width: "58" | "80" = "80") {
  const session = await requireBranchSession(PERMISSIONS.POS.ACCESS);

  const sale = await PosService.getSale(saleId, session.user.organizationId);
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
  });
  const taxMode = await TaxSettingsService.getTaxMode(session.user.organizationId);

  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  return ReceiptService.generateHtmlWithQr(
    {
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
      timezone: org?.timezone ?? undefined,
      verificationUrl: ReceiptService.getVerificationUrl(baseUrl, sale.invoiceNumber),
    },
    width,
  );
}

export async function openRegisterSessionAction(
  cashRegisterId: string,
  openingBalance: number,
) {
  try {
    const session = await requireBranchSession(PERMISSIONS.CASH_REGISTER.OPEN);
    const regSession = await CashRegisterService.openSession(
      cashRegisterId,
      openingBalance,
      session.user.id,
      session.user.organizationId,
    );
    revalidatePath("/pos");
    return { success: true, sessionId: regSession.id };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function closeRegisterSessionAction(
  sessionId: string,
  closingBalance: number,
) {
  try {
    const session = await requireBranchSession(PERMISSIONS.CASH_REGISTER.CLOSE);
    await CashRegisterService.closeSession(
      sessionId,
      closingBalance,
      session.user.id,
      session.user.organizationId,
    );
    revalidatePath("/pos");
    revalidatePath("/cash-register");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function listRegistersAction() {
  const session = await requireBranchSession(PERMISSIONS.CASH_REGISTER.VIEW);
  const registers = await CashRegisterService.listRegisters(session.user.branchId!);
  return registers.map((register) => ({
    id: register.id,
    code: register.code,
    name: register.name,
    sessions: register.sessions.map((s) => ({
      id: s.id,
      status: s.status,
      openingBalance: s.openingBalance.toString(),
      openedAt: s.openedAt.toISOString(),
    })),
  }));
}

export async function getRegisterSessionSummaryAction(sessionId: string) {
  const session = await requireBranchSession(PERMISSIONS.CASH_REGISTER.VIEW);
  return CashRegisterService.getSessionSummary(sessionId, session.user.organizationId);
}

const returnLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative(),
  productName: z.string(),
  sku: z.string(),
  costPrice: z.number().nonnegative(),
});

const returnSchema = z.object({
  originalSaleId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  sessionId: z.string().uuid(),
  cashRegisterId: z.string().uuid(),
  lines: z.array(returnLineSchema).min(1),
  payments: z.array(paymentSchema).min(1),
  idempotencyKey: z.string().optional(),
  notes: z.string().optional(),
});

export async function processReturnAction(input: z.infer<typeof returnSchema>) {
  try {
    const session = await requireBranchSession(PERMISSIONS.POS.SALE_RETURN);
    const data = returnSchema.parse(input);
    const sale = await PosService.processReturn({
      ...data,
      organizationId: session.user.organizationId,
      branchId: session.user.branchId!,
      userId: session.user.id,
    });

    revalidatePath("/pos");
    return { success: true, saleId: sale.id };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function voidSaleAction(input: {
  saleId: string;
  warehouseId: string;
  reason?: string;
}) {
  try {
    const session = await requireBranchSession(PERMISSIONS.POS.SALE_VOID);
    await PosService.voidSale({
      saleId: input.saleId,
      warehouseId: input.warehouseId,
      reason: input.reason,
      organizationId: session.user.organizationId,
      branchId: session.user.branchId!,
      userId: session.user.id,
    });
    revalidatePath("/pos");
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function searchCustomersAction(query: string) {
  const session = await requireBranchSession(PERMISSIONS.POS.ACCESS);
  if (!query.trim()) return [];

  return prisma.customer.findMany({
    where: {
      organizationId: session.user.organizationId,
      deletedAt: null,
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        { code: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 10,
    select: {
      id: true,
      name: true,
      code: true,
      phone: true,
      loyaltyPoints: true,
      membershipTier: true,
    },
  });
}

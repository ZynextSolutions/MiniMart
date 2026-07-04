import { prisma } from "@/infrastructure/database/prisma";
import { POS_TRANSACTION_OPTIONS } from "@/infrastructure/database/transaction-options";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors/app-error";
import { AccountingEngine } from "@/lib/services/accounting-engine";
import { AuditService } from "@/lib/services/audit-service";
import { InventoryService } from "@/lib/services/inventory-service";
import { NotificationService } from "@/lib/services/notification-service";
import {
  calculateCartTotals,
  calculateChange,
  calculateLine,
  type Discount,
} from "@/lib/services/pos-calculation";
import { generateSaleDocumentNumber } from "@/lib/services/sale-document-number";
import { TaxSettingsService } from "@/lib/services/tax-settings-service";
import { normalizeTaxRatePercent } from "@/lib/utils/tax";
import type { PaymentMethod, SaleType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface CartLineDTO {
  variantId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  taxRateId?: string;
  taxRate: number;
  lineDiscount?: Discount | null;
  costPrice?: number;
}

export interface PaymentDTO {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface CompleteSaleDTO {
  organizationId: string;
  branchId: string;
  userId: string;
  warehouseId: string;
  sessionId: string;
  cashRegisterId: string;
  customerId?: string;
  couponCode?: string;
  orderDiscount?: Discount | null;
  lines: CartLineDTO[];
  payments: PaymentDTO[];
  cashReceived?: number;
  idempotencyKey?: string;
  notes?: string;
}

export interface ReturnSaleDTO {
  organizationId: string;
  branchId: string;
  userId: string;
  warehouseId: string;
  sessionId: string;
  cashRegisterId: string;
  originalSaleId: string;
  lines: { variantId: string; quantity: number; unitPrice: number; taxRate: number; productName: string; sku: string; costPrice: number }[];
  payments: PaymentDTO[];
  idempotencyKey?: string;
  notes?: string;
}

export class PosService {
  private static readonly PRICE_TOLERANCE = 0.02;

  private static amountsMatch(a: number, b: number): boolean {
    return Math.abs(a - b) <= PosService.PRICE_TOLERANCE;
  }

  private static async validateRegisterContext(dto: {
    organizationId: string;
    branchId: string;
    sessionId: string;
    cashRegisterId: string;
    warehouseId: string;
  }): Promise<void> {
    const session = await prisma.cashRegisterSession.findFirst({
      where: { id: dto.sessionId, status: "OPEN" },
      include: { cashRegister: { include: { branch: true } } },
    });
    if (!session) throw new ValidationError("Cash register session is not open");
    if (session.cashRegisterId !== dto.cashRegisterId) {
      throw new ValidationError("Session does not belong to the selected register");
    }
    if (session.cashRegister.branch.organizationId !== dto.organizationId) {
      throw new ValidationError("Invalid cash register session");
    }
    if (session.cashRegister.branchId !== dto.branchId) {
      throw new ValidationError("Cash register is not in the current branch");
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: {
        id: dto.warehouseId,
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!warehouse) throw new ValidationError("Invalid warehouse for this branch");
  }

  private static async resolveAuthoritativeSaleLines(
    organizationId: string,
    lines: CartLineDTO[],
  ): Promise<CartLineDTO[]> {
    const variantIds = [...new Set(lines.map((l) => l.variantId))];
    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        deletedAt: null,
        isActive: true,
        product: {
          organizationId,
          deletedAt: null,
          isActive: true,
        },
      },
      include: {
        product: {
          include: { taxRate: { select: { id: true, rate: true } } },
        },
      },
    });

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    return lines.map((line) => {
      const variant = variantMap.get(line.variantId);
      if (!variant) throw new NotFoundError("Product variant");

      const authoritativePrice = Number(variant.sellingPrice);
      const authoritativeCost = Number(variant.costPrice);
      const taxRateId = variant.product.taxRate?.id;
      const authoritativeTaxRate = variant.product.taxRate
        ? normalizeTaxRatePercent(Number(variant.product.taxRate.rate))
        : 0;

      if (!PosService.amountsMatch(line.unitPrice, authoritativePrice)) {
        throw new ValidationError(`Price mismatch for ${line.sku}`);
      }
      if (!PosService.amountsMatch(line.taxRate, authoritativeTaxRate)) {
        throw new ValidationError(`Tax rate mismatch for ${line.sku}`);
      }
      if (line.taxRateId && taxRateId && line.taxRateId !== taxRateId) {
        throw new ValidationError(`Tax rate mismatch for ${line.sku}`);
      }

      return {
        ...line,
        productName: variant.product.name,
        sku: variant.sku,
        unitPrice: authoritativePrice,
        taxRateId: taxRateId ?? undefined,
        taxRate: authoritativeTaxRate,
        costPrice: authoritativeCost,
      };
    });
  }

  static async lookupByBarcode(organizationId: string, code: string) {
    const barcode = await prisma.productBarcode.findFirst({
      where: { organizationId, code },
      include: {
        product: {
          include: {
            unit: { select: { abbreviation: true } },
            images: { where: { isPrimary: true }, take: 1 },
            taxRate: { select: { id: true, rate: true } },
            variants: {
              where: { deletedAt: null, isActive: true },
              take: 1,
            },
          },
        },
        variant: {
          include: {
            product: {
              include: {
                unit: { select: { abbreviation: true } },
                images: { where: { isPrimary: true }, take: 1 },
                taxRate: { select: { id: true, rate: true } },
              },
            },
          },
        },
      },
    });

    if (!barcode) return null;
    const product = barcode.variant?.product ?? barcode.product;
    if (!product || product.organizationId !== organizationId || product.deletedAt) {
      return null;
    }

    const variant = barcode.variant ?? barcode.product.variants?.[0];
    if (!variant) return null;

    return {
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      sku: variant.sku,
      sellingPrice: Number(variant.sellingPrice),
      costPrice: Number(variant.costPrice),
      taxRateId: product.taxRate?.id,
      taxRate: product.taxRate ? normalizeTaxRatePercent(Number(product.taxRate.rate)) : 0,
      unit: product.unit.abbreviation,
      imageUrl: product.images[0]?.url ?? null,
      barcode: barcode.code,
    };
  }

  static async validateCoupon(organizationId: string, code: string, subtotal: number) {
    const coupon = await prisma.coupon.findFirst({
      where: {
        organizationId,
        code: code.toUpperCase(),
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    if (!coupon) throw new NotFoundError("Coupon");
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      throw new ValidationError("Coupon usage limit reached");
    }

    const discount =
      coupon.discountType === "PERCENTAGE"
        ? subtotal * (Number(coupon.discountValue) / 100)
        : Number(coupon.discountValue);

    return { coupon, discountAmount: Math.min(discount, subtotal) };
  }

  static async validateGiftCard(organizationId: string, code: string, amount: number) {
    const card = await prisma.giftCard.findFirst({
      where: { code, isActive: true },
      include: { customer: { select: { organizationId: true } } },
    });
    if (!card) throw new NotFoundError("Gift card");
    if (!card.customer || card.customer.organizationId !== organizationId) {
      throw new NotFoundError("Gift card");
    }
    if (card.expiresAt && card.expiresAt < new Date()) {
      throw new ValidationError("Gift card expired");
    }
    if (Number(card.balance) < amount) {
      throw new ValidationError("Insufficient gift card balance");
    }
    return card;
  }

  static async completeSale(dto: CompleteSaleDTO) {
    if (dto.lines.length === 0) throw new ValidationError("Cart is empty");

    if (dto.idempotencyKey) {
      const existing = await prisma.sale.findFirst({
        where: {
          organizationId: dto.organizationId,
          idempotencyKey: dto.idempotencyKey,
        },
        include: { payments: true, lines: true },
      });
      if (existing) return existing;
    }

    await PosService.validateRegisterContext(dto);
    const authoritativeLines = await PosService.resolveAuthoritativeSaleLines(
      dto.organizationId,
      dto.lines,
    );

    let couponDiscount = 0;
    let couponId: string | undefined;
    if (dto.couponCode) {
      const lineInputs = authoritativeLines.map((l) => ({
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        taxRate: normalizeTaxRatePercent(l.taxRate),
        lineDiscount: l.lineDiscount,
      }));
      const preTotals = calculateCartTotals(lineInputs, dto.orderDiscount);
      const couponResult = await this.validateCoupon(
        dto.organizationId,
        dto.couponCode,
        preTotals.subtotal,
      );
      couponDiscount = couponResult.discountAmount;
      couponId = couponResult.coupon.id;
    }

    const lineInputs = authoritativeLines.map((l) => ({
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      taxRate: normalizeTaxRatePercent(l.taxRate),
      lineDiscount: l.lineDiscount,
    }));
    const taxMode = await TaxSettingsService.getTaxMode(dto.organizationId);
    const totals = calculateCartTotals(
      lineInputs,
      dto.orderDiscount,
      couponDiscount,
      taxMode,
    );

    const paymentSum = dto.payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(paymentSum - totals.grandTotal) > 0.02) {
      throw new ValidationError(
        `Payment total ${paymentSum} does not match grand total ${totals.grandTotal}`,
      );
    }

    const isCashOnlyPayment =
      dto.payments.length === 1 && dto.payments[0]?.method === "CASH";
    const amountPaid = isCashOnlyPayment
      ? (dto.cashReceived ?? dto.payments[0].amount)
      : totals.grandTotal;
    if (isCashOnlyPayment && amountPaid + 0.02 < totals.grandTotal) {
      throw new ValidationError("Insufficient cash received");
    }
    const changeAmount = isCashOnlyPayment
      ? calculateChange(amountPaid, totals.grandTotal)
      : 0;

    if (dto.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId: dto.organizationId, deletedAt: null },
      });
      if (!customer) throw new NotFoundError("Customer");

      const creditPayment = dto.payments.find((p) => p.method === "CREDIT");
      if (creditPayment && Number(customer.creditLimit) > 0) {
        // Basic credit limit check
        const ledger = await prisma.customerLedger.findFirst({
          where: { customerId: customer.id },
          orderBy: { entryDate: "desc" },
        });
        const balance = ledger ? Number(ledger.balance) : 0;
        if (balance + creditPayment.amount > Number(customer.creditLimit)) {
          throw new ValidationError("Customer credit limit exceeded");
        }
      }
    }

    const sale = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateSaleDocumentNumber("INV", dto.organizationId);

      const sale = await tx.sale.create({
        data: {
          organizationId: dto.organizationId,
          branchId: dto.branchId,
          invoiceNumber,
          saleType: "SALE",
          saleDate: new Date(),
          customerId: dto.customerId,
          cashierId: dto.userId,
          cashRegisterId: dto.cashRegisterId,
          sessionId: dto.sessionId,
          status: "COMPLETED",
          subtotal: new Decimal(totals.subtotal),
          discountAmount: new Decimal(totals.lineDiscountTotal + totals.orderDiscountAmount + totals.couponDiscount),
          taxAmount: new Decimal(totals.taxTotal),
          grandTotal: new Decimal(totals.grandTotal),
          amountPaid: new Decimal(amountPaid),
          changeAmount: new Decimal(changeAmount),
          couponCode: dto.couponCode,
          notes: dto.notes,
          idempotencyKey: dto.idempotencyKey,
          lines: {
            create: authoritativeLines.map((line) => {
              const calc = calculateLine({
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                taxRate: normalizeTaxRatePercent(line.taxRate),
                lineDiscount: line.lineDiscount,
              }, taxMode);
              return {
                variantId: line.variantId,
                productName: line.productName,
                sku: line.sku,
                quantity: new Decimal(line.quantity),
                unitPrice: new Decimal(line.unitPrice),
                discountAmount: new Decimal(calc.discountAmount),
                taxRateId: line.taxRateId,
                taxAmount: new Decimal(calc.taxAmount),
                lineTotal: new Decimal(calc.lineTotal),
                costPrice: new Decimal(line.costPrice ?? 0),
              };
            }),
          },
          payments: {
            create: dto.payments.map((p) => ({
              method: p.method,
              amount: new Decimal(p.amount),
              reference: p.reference,
            })),
          },
        },
        include: { lines: true, payments: true },
      });

      const { totalCogs } = await InventoryService.processSaleDeduction(tx, {
        warehouseId: dto.warehouseId,
        saleId: sale.id,
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        userId: dto.userId,
        lines: authoritativeLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      });

      await AccountingEngine.postSale(tx, {
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        userId: dto.userId,
        saleId: sale.id,
        saleDate: sale.saleDate,
        subtotal: totals.subtotal,
        discountAmount: totals.lineDiscountTotal + totals.orderDiscountAmount + totals.couponDiscount,
        taxAmount: totals.taxTotal,
        grandTotal: totals.grandTotal,
        totalCogs: Number(totalCogs),
        payments: dto.payments,
        idempotencyKey: dto.idempotencyKey ? `journal-${dto.idempotencyKey}` : undefined,
      });

      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      for (const payment of dto.payments) {
        if (payment.method === "GIFT_CARD" && payment.reference) {
          await this.validateGiftCard(
            dto.organizationId,
            payment.reference,
            payment.amount,
          );
          await tx.giftCard.update({
            where: { code: payment.reference },
            data: { balance: { decrement: payment.amount } },
          });
        }
      }

      if (dto.customerId) {
        const pointsEarned = Math.floor(totals.grandTotal / 100);
        if (pointsEarned > 0) {
          await tx.customer.update({
            where: { id: dto.customerId },
            data: { loyaltyPoints: { increment: pointsEarned } },
          });
        }
      }

      await AuditService.log(
        {
          organizationId: dto.organizationId,
          userId: dto.userId,
          branchId: dto.branchId,
          action: "pos.sale.completed",
          entityType: "Sale",
          entityId: sale.id,
          after: { invoiceNumber, grandTotal: totals.grandTotal },
        },
        tx,
      );

      return sale;
    }, POS_TRANSACTION_OPTIONS);

    void NotificationService.checkSaleAlerts({
      organizationId: dto.organizationId,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      subtotal: totals.subtotal,
      discountAmount:
        totals.lineDiscountTotal + totals.orderDiscountAmount + totals.couponDiscount,
      grandTotal: totals.grandTotal,
      cashierId: dto.userId,
    }).catch(() => {});

    return sale;
  }

  static async holdSale(
    organizationId: string,
    branchId: string,
    userId: string,
    cartData: unknown,
    customerId?: string,
  ) {
    const snapshot = cartData as { items?: unknown[] };
    if (!snapshot.items?.length) {
      throw new ValidationError("Cannot hold an empty cart");
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const holdNumber =
        attempt < 3
          ? await generateSaleDocumentNumber("HOLD", organizationId)
          : `HOLD-${year}-${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
      try {
        return await prisma.saleHold.create({
          data: {
            organizationId,
            branchId,
            holdNumber,
            cashierId: userId,
            cartData: cartData as object,
            customerId,
            expiresAt,
          },
        });
      } catch (error) {
        const isUniqueConstraintError =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "P2002";

        if (!isUniqueConstraintError || attempt === 7) throw error;
      }
    }

    throw new ConflictError("Unable to generate unique hold number");
  }

  static async listHolds(organizationId: string, branchId: string) {
    return prisma.saleHold.findMany({
      where: {
        organizationId,
        branchId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  static async deleteHold(id: string, organizationId: string, branchId: string) {
    const hold = await prisma.saleHold.findFirst({
      where: { id, organizationId, branchId },
    });
    if (!hold) throw new NotFoundError("Held sale");
    await prisma.saleHold.delete({ where: { id } });
  }

  static async getSale(id: string, organizationId: string) {
    const sale = await prisma.sale.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        lines: true,
        payments: true,
        customer: { select: { name: true } },
        cashier: { select: { firstName: true, lastName: true } },
      },
    });
    if (!sale) throw new NotFoundError("Sale");
    return sale;
  }

  static async processReturn(dto: ReturnSaleDTO) {
    if (dto.idempotencyKey) {
      const existing = await prisma.sale.findFirst({
        where: {
          organizationId: dto.organizationId,
          idempotencyKey: dto.idempotencyKey,
        },
        include: { payments: true, lines: true },
      });
      if (existing) return existing;
    }

    await PosService.validateRegisterContext(dto);

    const original = await prisma.sale.findFirst({
      where: {
        id: dto.originalSaleId,
        organizationId: dto.organizationId,
        deletedAt: null,
        saleType: "SALE",
        status: "COMPLETED",
      },
      include: {
        lines: { include: { taxRate: { select: { rate: true } } } },
      },
    });
    if (!original) throw new NotFoundError("Original sale");
    if (original.branchId !== dto.branchId) {
      throw new ValidationError("Return must be processed at the original sale branch");
    }

    const priorReturns = await prisma.sale.findMany({
      where: {
        originalSaleId: dto.originalSaleId,
        organizationId: dto.organizationId,
        saleType: "RETURN",
        status: "COMPLETED",
        deletedAt: null,
      },
      include: { lines: true },
    });

    const returnedByVariant = new Map<string, number>();
    for (const ret of priorReturns) {
      for (const line of ret.lines) {
        returnedByVariant.set(
          line.variantId,
          (returnedByVariant.get(line.variantId) ?? 0) + Number(line.quantity),
        );
      }
    }

    const originalByVariant = new Map(original.lines.map((l) => [l.variantId, l]));
    const seenVariants = new Set<string>();

    const authoritativeLines = dto.lines.map((line) => {
      if (seenVariants.has(line.variantId)) {
        throw new ValidationError(`Duplicate return line for ${line.sku}`);
      }
      seenVariants.add(line.variantId);

      const orig = originalByVariant.get(line.variantId);
      if (!orig) {
        throw new ValidationError(`Variant not found on original sale: ${line.sku}`);
      }

      const soldQty = Number(orig.quantity);
      const alreadyReturned = returnedByVariant.get(line.variantId) ?? 0;
      const remaining = soldQty - alreadyReturned;

      if (line.quantity > remaining + PosService.PRICE_TOLERANCE) {
        throw new ValidationError(
          `Return quantity exceeds remaining for ${orig.sku} (max ${remaining})`,
        );
      }

      const unitPrice = Number(orig.unitPrice);
      const taxRate = orig.taxRate
        ? normalizeTaxRatePercent(Number(orig.taxRate.rate))
        : soldQty > 0 && Number(orig.unitPrice) > 0
          ? normalizeTaxRatePercent(
              (Number(orig.taxAmount) / soldQty / Number(orig.unitPrice)) * 100,
            )
          : 0;

      if (!PosService.amountsMatch(line.unitPrice, unitPrice)) {
        throw new ValidationError(`Return price mismatch for ${orig.sku}`);
      }

      return {
        variantId: line.variantId,
        quantity: line.quantity,
        unitPrice,
        taxRate,
        productName: orig.productName,
        sku: orig.sku,
        costPrice: Number(orig.costPrice),
      };
    });

    const lineInputs = authoritativeLines.map((l) => ({
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      taxRate: normalizeTaxRatePercent(l.taxRate),
    }));
    const taxMode = await TaxSettingsService.getTaxMode(dto.organizationId);
    const totals = calculateCartTotals(lineInputs, undefined, 0, taxMode);

    const paymentSum = dto.payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(paymentSum - totals.grandTotal) > 0.02) {
      throw new ValidationError("Refund payment mismatch");
    }

    const sale = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateSaleDocumentNumber("INV", dto.organizationId);

      const sale = await tx.sale.create({
        data: {
          organizationId: dto.organizationId,
          branchId: dto.branchId,
          invoiceNumber,
          saleType: "RETURN" as SaleType,
          saleDate: new Date(),
          cashierId: dto.userId,
          cashRegisterId: dto.cashRegisterId,
          sessionId: dto.sessionId,
          originalSaleId: dto.originalSaleId,
          status: "COMPLETED",
          subtotal: new Decimal(totals.subtotal),
          discountAmount: new Decimal(0),
          taxAmount: new Decimal(totals.taxTotal),
          grandTotal: new Decimal(totals.grandTotal),
          amountPaid: new Decimal(totals.grandTotal),
          changeAmount: new Decimal(0),
          idempotencyKey: dto.idempotencyKey,
          notes: dto.notes,
          lines: {
            create: authoritativeLines.map((line) => {
              const calc = calculateLine({
                unitPrice: line.unitPrice,
                quantity: line.quantity,
                taxRate: normalizeTaxRatePercent(line.taxRate),
              }, taxMode);
              return {
                variantId: line.variantId,
                productName: line.productName,
                sku: line.sku,
                quantity: new Decimal(line.quantity),
                unitPrice: new Decimal(line.unitPrice),
                discountAmount: new Decimal(0),
                taxAmount: new Decimal(calc.taxAmount),
                lineTotal: new Decimal(calc.lineTotal),
                costPrice: new Decimal(line.costPrice),
              };
            }),
          },
          payments: {
            create: dto.payments.map((p) => ({
              method: p.method,
              amount: new Decimal(p.amount),
              reference: p.reference,
            })),
          },
        },
        include: { lines: true, payments: true },
      });

      const { totalCogs } = await InventoryService.processReturnRestock(tx, {
        warehouseId: dto.warehouseId,
        saleId: sale.id,
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        userId: dto.userId,
        lines: authoritativeLines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          unitCost: l.costPrice,
        })),
      });

      await AccountingEngine.postSaleReturn(tx, {
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        userId: dto.userId,
        saleId: sale.id,
        saleDate: sale.saleDate,
        subtotal: totals.subtotal,
        discountAmount: 0,
        taxAmount: totals.taxTotal,
        grandTotal: totals.grandTotal,
        totalCogs: Number(totalCogs),
        payments: dto.payments,
        idempotencyKey: dto.idempotencyKey
          ? `journal-return-${dto.idempotencyKey}`
          : undefined,
      });

      await AuditService.log(
        {
          organizationId: dto.organizationId,
          userId: dto.userId,
          branchId: dto.branchId,
          action: "pos.sale.return",
          entityType: "Sale",
          entityId: sale.id,
          after: { originalSaleId: dto.originalSaleId, grandTotal: totals.grandTotal },
        },
        tx,
      );

      return sale;
    }, POS_TRANSACTION_OPTIONS);

    void NotificationService.checkReturnAlert({
      organizationId: dto.organizationId,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      refundAmount: totals.grandTotal,
      originalSaleTotal: Number(original.grandTotal),
      cashierId: dto.userId,
    }).catch(() => {});

    return sale;
  }

  static async voidSale(dto: {
    saleId: string;
    organizationId: string;
    branchId: string;
    warehouseId: string;
    userId: string;
    reason?: string;
  }) {
    const sale = await prisma.sale.findFirst({
      where: {
        id: dto.saleId,
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        saleType: "SALE",
        status: "COMPLETED",
        deletedAt: null,
      },
      include: { lines: true, payments: true },
    });
    if (!sale) throw new NotFoundError("Sale");

    return prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: "VOID", notes: dto.reason ?? sale.notes },
      });

      const { totalCogs } = await InventoryService.processReturnRestock(tx, {
        warehouseId: dto.warehouseId,
        saleId: sale.id,
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        userId: dto.userId,
        lines: sale.lines.map((l) => ({
          variantId: l.variantId,
          quantity: Number(l.quantity),
          unitCost: Number(l.costPrice),
        })),
      });

      await AccountingEngine.postSaleReturn(tx, {
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        userId: dto.userId,
        saleId: sale.id,
        saleDate: new Date(),
        subtotal: Number(sale.subtotal),
        discountAmount: Number(sale.discountAmount),
        taxAmount: Number(sale.taxAmount),
        grandTotal: Number(sale.grandTotal),
        totalCogs: Number(totalCogs),
        payments: sale.payments.map((p) => ({
          method: p.method,
          amount: Number(p.amount),
          reference: p.reference ?? undefined,
        })),
      });

      await AuditService.log(
        {
          organizationId: dto.organizationId,
          userId: dto.userId,
          branchId: dto.branchId,
          action: "pos.sale.void",
          entityType: "Sale",
          entityId: sale.id,
          after: { status: "VOID" },
        },
        tx,
      );

      return sale;
    }, POS_TRANSACTION_OPTIONS);
  }

  static async processExchange(dto: ReturnSaleDTO & {
    newLines: CompleteSaleDTO["lines"];
    newPayments: CompleteSaleDTO["payments"];
  }) {
    const returnSale = await this.processReturn({
      ...dto,
      lines: dto.lines,
      payments: dto.payments,
    });

    const exchangeSale = await this.completeSale({
      organizationId: dto.organizationId,
      branchId: dto.branchId,
      warehouseId: dto.warehouseId,
      userId: dto.userId,
      sessionId: dto.sessionId,
      cashRegisterId: dto.cashRegisterId,
      lines: dto.newLines,
      payments: dto.newPayments,
      notes: `Exchange for ${returnSale.invoiceNumber}`,
    });

    return { returnSale, exchangeSale };
  }
}

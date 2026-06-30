import { prisma } from "@/infrastructure/database/prisma";

type PurchasePrefix = "PR" | "PO" | "GRN" | "AP";

export async function generatePurchaseDocumentNumber(
  prefix: PurchasePrefix,
  organizationId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;

  const lookup: Record<PurchasePrefix, () => Promise<string | undefined>> = {
    PR: async () => {
      const last = await prisma.purchaseRequest.findFirst({
        where: { organizationId, requestNumber: { startsWith: pattern } },
        orderBy: { requestNumber: "desc" },
        select: { requestNumber: true },
      });
      return last?.requestNumber;
    },
    PO: async () => {
      const last = await prisma.purchaseOrder.findFirst({
        where: { organizationId, orderNumber: { startsWith: pattern } },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });
      return last?.orderNumber;
    },
    GRN: async () => {
      const last = await prisma.goodsReceipt.findFirst({
        where: { organizationId, receiptNumber: { startsWith: pattern } },
        orderBy: { receiptNumber: "desc" },
        select: { receiptNumber: true },
      });
      return last?.receiptNumber;
    },
    AP: async () => {
      const last = await prisma.supplierInvoice.findFirst({
        where: { organizationId, invoiceNumber: { startsWith: pattern } },
        orderBy: { invoiceNumber: "desc" },
        select: { invoiceNumber: true },
      });
      return last?.invoiceNumber;
    },
  };

  const lastNumber = await lookup[prefix]();
  const seq = lastNumber ? parseInt(lastNumber.slice(-5), 10) + 1 : 1;
  return `${pattern}${String(seq).padStart(5, "0")}`;
}

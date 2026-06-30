import { prisma } from "@/infrastructure/database/prisma";

type SaleDocPrefix = "INV" | "HOLD" | "JRN";

export async function generateSaleDocumentNumber(
  prefix: SaleDocPrefix,
  organizationId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;

  if (prefix === "HOLD") {
    const last = await prisma.saleHold.findFirst({
      where: { organizationId, holdNumber: { startsWith: pattern } },
      orderBy: { holdNumber: "desc" },
      select: { holdNumber: true },
    });
    const seq = last ? parseInt(last.holdNumber.slice(-5), 10) + 1 : 1;
    return `${pattern}${String(seq).padStart(5, "0")}`;
  }

  if (prefix === "INV") {
    const last = await prisma.sale.findFirst({
      where: { organizationId, invoiceNumber: { startsWith: pattern } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });
    const seq = last ? parseInt(last.invoiceNumber.slice(-5), 10) + 1 : 1;
    return `${pattern}${String(seq).padStart(5, "0")}`;
  }

  const last = await prisma.journalEntry.findFirst({
    where: { organizationId, entryNumber: { startsWith: pattern } },
    orderBy: { entryNumber: "desc" },
    select: { entryNumber: true },
  });
  const seq = last ? parseInt(last.entryNumber.slice(-5), 10) + 1 : 1;
  return `${pattern}${String(seq).padStart(5, "0")}`;
}

import { prisma } from "@/infrastructure/database/prisma";

type DocumentPrefix = "STK-IN" | "STK-OUT" | "ADJ" | "TRF" | "CNT";

const COUNTERS: Record<
  DocumentPrefix,
  { table: "inventoryMovement" | "stockCount"; field: "movementNumber" | "countNumber"; orgField?: boolean }
> = {
  "STK-IN": { table: "inventoryMovement", field: "movementNumber" },
  "STK-OUT": { table: "inventoryMovement", field: "movementNumber" },
  ADJ: { table: "inventoryMovement", field: "movementNumber" },
  TRF: { table: "inventoryMovement", field: "movementNumber" },
  CNT: { table: "stockCount", field: "countNumber", orgField: false },
};

export async function generateDocumentNumber(
  prefix: DocumentPrefix,
  organizationId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;

  const counter = COUNTERS[prefix];

  if (counter.table === "inventoryMovement") {
    const last = await prisma.inventoryMovement.findFirst({
      where: {
        organizationId,
        movementNumber: { startsWith: pattern },
      },
      orderBy: { movementNumber: "desc" },
      select: { movementNumber: true },
    });

    const seq = last ? parseInt(last.movementNumber.slice(-5), 10) + 1 : 1;
    return `${pattern}${String(seq).padStart(5, "0")}`;
  }

  const last = await prisma.stockCount.findFirst({
    where: { countNumber: { startsWith: pattern } },
    orderBy: { countNumber: "desc" },
    select: { countNumber: true },
  });

  const seq = last ? parseInt(last.countNumber.slice(-5), 10) + 1 : 1;
  return `${pattern}${String(seq).padStart(5, "0")}`;
}

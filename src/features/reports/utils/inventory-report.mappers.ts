import { formatMoney, formatNumber } from "@/lib/utils/format";

export function mapStockRows(
  levels: {
    quantity: { toString(): string };
    avgCost: { toString(): string };
    warehouse: { name: string };
    variant: { sku: string; product: { name: string } };
  }[],
  currency?: string,
) {
  return levels.map((l) => ({
    sku: l.variant.sku,
    productName: l.variant.product.name,
    warehouseName: l.warehouse.name,
    quantity: formatNumber(l.quantity.toString()),
    value: formatMoney(Number(l.quantity) * Number(l.avgCost), currency),
  }));
}

export function mapValuationRows(
  rows: {
    sku: string;
    productName: string;
    warehouseName: string;
    quantity: { toString(): string };
    totalValue: { toString(): string };
  }[],
  currency?: string,
) {
  return rows.map((r) => ({
    sku: r.sku,
    productName: r.productName,
    warehouseName: r.warehouseName,
    quantity: formatNumber(r.quantity.toString()),
    totalValue: formatMoney(r.totalValue.toString(), currency),
  }));
}

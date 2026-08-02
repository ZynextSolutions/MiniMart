import ExcelJS from "exceljs";
import { prisma } from "@/infrastructure/database/prisma";
import { getErrorMessage } from "@/lib/errors/app-error";
import { PlanLimitsService } from "@/platform/subscriptions/plan-limits.service";
import { ProductService } from "@/features/products/services/product.service";
import {
  PRODUCT_IMPORT_MAX_ROWS,
  normalizeImportRow,
  parseCsvText,
  rowsToObjects,
  type NormalizedImportRow,
  type ParsedImportRow,
  type ProductImportResult,
  type ProductImportRowResult,
} from "@/features/products/lib/product-import";

export type { ProductImportResult, ProductImportRowResult };

type LookupMaps = {
  unitsByKey: Map<string, string>;
  categoriesByKey: Map<string, string>;
  brandsByKey: Map<string, string>;
  suppliersByKey: Map<string, string>;
  taxRatesByKey: Map<string, string>;
};

function key(value: string): string {
  return value.trim().toLowerCase();
}

async function loadLookups(organizationId: string): Promise<LookupMaps> {
  const [units, categories, brands, suppliers, taxRates] = await Promise.all([
    prisma.unit.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true, abbreviation: true },
    }),
    prisma.productCategory.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true, slug: true },
    }),
    prisma.productBrand.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.supplier.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true, code: true },
    }),
    prisma.taxRate.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  const unitsByKey = new Map<string, string>();
  for (const unit of units) {
    unitsByKey.set(key(unit.abbreviation), unit.id);
    unitsByKey.set(key(unit.name), unit.id);
  }

  const categoriesByKey = new Map<string, string>();
  for (const category of categories) {
    categoriesByKey.set(key(category.name), category.id);
    if (category.slug) categoriesByKey.set(key(category.slug), category.id);
  }

  const brandsByKey = new Map<string, string>();
  for (const brand of brands) {
    brandsByKey.set(key(brand.name), brand.id);
  }

  const suppliersByKey = new Map<string, string>();
  for (const supplier of suppliers) {
    suppliersByKey.set(key(supplier.name), supplier.id);
    suppliersByKey.set(key(supplier.code), supplier.id);
  }

  const taxRatesByKey = new Map<string, string>();
  for (const taxRate of taxRates) {
    taxRatesByKey.set(key(taxRate.name), taxRate.id);
  }

  return { unitsByKey, categoriesByKey, brandsByKey, suppliersByKey, taxRatesByKey };
}

function resolveOptional(
  value: string | undefined,
  map: Map<string, string>,
  label: string,
): string | undefined {
  if (!value) return undefined;
  const id = map.get(key(value));
  if (!id) throw new Error(`${label} "${value}" not found`);
  return id;
}

export class ProductImportService {
  static async parseFile(fileName: string, buffer: Buffer): Promise<ParsedImportRow[]> {
    const lower = fileName.toLowerCase();
    let grid: string[][];

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      grid = await this.parseExcel(buffer);
    } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      grid = parseCsvText(buffer.toString("utf8"));
    } else {
      // Try CSV first, then Excel
      try {
        grid = parseCsvText(buffer.toString("utf8"));
        if (grid.length === 0) throw new Error("empty");
      } catch {
        grid = await this.parseExcel(buffer);
      }
    }

    const rows = rowsToObjects(grid);
    if (rows.length === 0) {
      throw new Error("No product rows found in the file");
    }
    if (rows.length > PRODUCT_IMPORT_MAX_ROWS) {
      throw new Error(
        `Too many rows (${rows.length}). Maximum is ${PRODUCT_IMPORT_MAX_ROWS} products per import.`,
      );
    }
    return rows;
  }

  private static async parseExcel(buffer: Buffer): Promise<string[][]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("Excel file has no worksheets");

    const grid: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        while (values.length < colNumber - 1) values.push("");
        const text =
          cell.text !== undefined && cell.text !== ""
            ? String(cell.text)
            : cell.value === null || cell.value === undefined
              ? ""
              : String(cell.value);
        values.push(text.trim());
      });
      grid.push(values);
    });
    return grid;
  }

  static async importRows(
    organizationId: string,
    actorId: string,
    parsedRows: ParsedImportRow[],
  ): Promise<ProductImportResult> {
    const lookups = await loadLookups(organizationId);
    const limits = await PlanLimitsService.getLimits(organizationId);
    let productCount = await PlanLimitsService.getCurrentCount(organizationId, "maxProducts");
    const maxProducts = limits.maxProducts;

    const seenSkus = new Set<string>();
    const results: ProductImportRowResult[] = [];
    let created = 0;
    let failed = 0;

    for (const parsed of parsedRows) {
      let normalized: NormalizedImportRow | null = null;
      try {
        normalized = normalizeImportRow(parsed);
        const skuKey = key(normalized.sku);

        if (seenSkus.has(skuKey)) {
          throw new Error(`Duplicate SKU "${normalized.sku}" in import file`);
        }
        seenSkus.add(skuKey);

        if (maxProducts !== undefined && maxProducts >= 0 && productCount >= maxProducts) {
          throw new Error(
            `Plan limit reached for products. Maximum allowed: ${maxProducts}. Please upgrade your plan.`,
          );
        }

        const unitId = lookups.unitsByKey.get(key(normalized.unit));
        if (!unitId) {
          throw new Error(
            `Unit "${normalized.unit}" not found. Use an existing unit name or abbreviation.`,
          );
        }

        const categoryId = resolveOptional(
          normalized.category,
          lookups.categoriesByKey,
          "Category",
        );
        const brandId = resolveOptional(normalized.brand, lookups.brandsByKey, "Brand");
        const supplierId = resolveOptional(
          normalized.supplier,
          lookups.suppliersByKey,
          "Supplier",
        );
        const taxRateId = resolveOptional(
          normalized.taxRate,
          lookups.taxRatesByKey,
          "Tax rate",
        );

        const product = await ProductService.create(
          {
            organizationId,
            sku: normalized.sku,
            name: normalized.name,
            unitId,
            sellingPrice: normalized.sellingPrice,
            costPrice: normalized.costPrice,
            barcode: normalized.barcode,
            categoryId,
            brandId,
            supplierId,
            taxRateId,
            wholesalePrice: normalized.wholesalePrice,
            minStock: normalized.minStock,
            reorderLevel: normalized.reorderLevel,
            trackBatch: normalized.trackBatch,
            trackExpiry: normalized.trackExpiry,
            description: normalized.description,
          },
          actorId,
        );

        productCount += 1;
        created += 1;
        results.push({
          rowNumber: normalized.rowNumber,
          sku: normalized.sku,
          name: normalized.name,
          success: true,
          productId: product.id,
        });
      } catch (error) {
        failed += 1;
        results.push({
          rowNumber: normalized?.rowNumber ?? parsed.rowNumber,
          sku: normalized?.sku ?? parsed.values.sku ?? "",
          name: normalized?.name ?? parsed.values.name ?? "",
          success: false,
          error: getErrorMessage(error),
        });
      }
    }

    return {
      total: parsedRows.length,
      created,
      failed,
      results,
    };
  }
}

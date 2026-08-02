export const PRODUCT_IMPORT_HEADERS = [
  "sku",
  "name",
  "unit",
  "sellingPrice",
  "costPrice",
  "barcode",
  "category",
  "brand",
  "supplier",
  "taxRate",
  "wholesalePrice",
  "minStock",
  "reorderLevel",
  "trackBatch",
  "trackExpiry",
  "description",
] as const;

export type ProductImportHeader = (typeof PRODUCT_IMPORT_HEADERS)[number];

export const PRODUCT_IMPORT_MAX_ROWS = 500;

export const PRODUCT_IMPORT_SAMPLE_ROWS: Record<ProductImportHeader, string>[] = [
  {
    sku: "SKU-001",
    name: "Sample Soft Drink 330ml",
    unit: "pcs",
    sellingPrice: "800",
    costPrice: "600",
    barcode: "",
    category: "",
    brand: "",
    supplier: "",
    taxRate: "",
    wholesalePrice: "",
    minStock: "10",
    reorderLevel: "20",
    trackBatch: "false",
    trackExpiry: "false",
    description: "Example row — replace with your products",
  },
];

export type ParsedImportRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type NormalizedImportRow = {
  rowNumber: number;
  sku: string;
  name: string;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  barcode?: string;
  category?: string;
  brand?: string;
  supplier?: string;
  taxRate?: string;
  wholesalePrice?: number;
  minStock?: number;
  reorderLevel?: number;
  trackBatch?: boolean;
  trackExpiry?: boolean;
  description?: string;
};

export type ProductImportRowResult = {
  rowNumber: number;
  sku: string;
  name: string;
  success: boolean;
  productId?: string;
  error?: string;
};

export type ProductImportResult = {
  total: number;
  created: number;
  failed: number;
  results: ProductImportRowResult[];
};

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .replace(/price$/, "price");
}

const HEADER_ALIASES: Record<string, ProductImportHeader> = {
  sku: "sku",
  productsku: "sku",
  name: "name",
  productname: "name",
  product: "name",
  unit: "unit",
  uom: "unit",
  unitabbr: "unit",
  abbreviation: "unit",
  sellingprice: "sellingPrice",
  price: "sellingPrice",
  retailprice: "sellingPrice",
  sellprice: "sellingPrice",
  costprice: "costPrice",
  cost: "costPrice",
  barcode: "barcode",
  barcod: "barcode",
  ean: "barcode",
  category: "category",
  brand: "brand",
  supplier: "supplier",
  suppliercode: "supplier",
  taxrate: "taxRate",
  tax: "taxRate",
  wholesaleprice: "wholesalePrice",
  wholesale: "wholesalePrice",
  minstock: "minStock",
  reorderlevel: "reorderLevel",
  reorder: "reorderLevel",
  trackbatch: "trackBatch",
  batch: "trackBatch",
  trackexpiry: "trackExpiry",
  expiry: "trackExpiry",
  description: "description",
  desc: "description",
};

export function mapImportHeader(header: string): ProductImportHeader | null {
  const key = normalizeHeader(header);
  return HEADER_ALIASES[key] ?? null;
}

/** Minimal RFC4180-ish CSV parser (handles quotes and commas). */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

export function rowsToObjects(grid: string[][]): ParsedImportRow[] {
  if (grid.length === 0) return [];

  const headerCells = grid[0].map((h) => h.trim());
  const mapped = headerCells.map((h) => mapImportHeader(h));

  const hasSku = mapped.includes("sku");
  const hasName = mapped.includes("name");
  const hasUnit = mapped.includes("unit");
  const hasSelling = mapped.includes("sellingPrice");

  if (!hasSku || !hasName || !hasUnit || !hasSelling) {
    throw new Error(
      "Missing required columns. Need at least: sku, name, unit, sellingPrice",
    );
  }

  const results: ParsedImportRow[] = [];

  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    const values: Record<string, string> = {};

    mapped.forEach((header, idx) => {
      if (!header) return;
      const raw = cells[idx] ?? "";
      values[header] = String(raw).trim();
    });

    const isEmpty = Object.values(values).every((v) => v === "");
    if (isEmpty) continue;

    results.push({ rowNumber: i + 1, values });
  }

  return results;
}

export function parseBooleanCell(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  const v = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  return undefined;
}

export function parseNumberCell(
  value: string | undefined,
  field: string,
  required = false,
): number | undefined {
  if (value === undefined || value === "") {
    if (required) throw new Error(`${field} is required`);
    return undefined;
  }
  const cleaned = value.replace(/,/g, "").trim();
  const num = Number(cleaned);
  if (Number.isNaN(num) || num < 0) {
    throw new Error(`${field} must be a valid number ≥ 0`);
  }
  return num;
}

export function normalizeImportRow(row: ParsedImportRow): NormalizedImportRow {
  const v = row.values;
  const sku = (v.sku ?? "").trim();
  const name = (v.name ?? "").trim();
  const unit = (v.unit ?? "").trim();

  if (!sku) throw new Error("sku is required");
  if (!name) throw new Error("name is required");
  if (!unit) throw new Error("unit is required");

  const sellingPrice = parseNumberCell(v.sellingPrice, "sellingPrice", true)!;
  const costPrice = parseNumberCell(v.costPrice, "costPrice") ?? 0;

  const trackBatch = parseBooleanCell(v.trackBatch);
  const trackExpiry = parseBooleanCell(v.trackExpiry);
  if (v.trackBatch && trackBatch === undefined) {
    throw new Error("trackBatch must be true/false");
  }
  if (v.trackExpiry && trackExpiry === undefined) {
    throw new Error("trackExpiry must be true/false");
  }

  return {
    rowNumber: row.rowNumber,
    sku,
    name,
    unit,
    sellingPrice,
    costPrice,
    barcode: v.barcode || undefined,
    category: v.category || undefined,
    brand: v.brand || undefined,
    supplier: v.supplier || undefined,
    taxRate: v.taxRate || undefined,
    wholesalePrice: parseNumberCell(v.wholesalePrice, "wholesalePrice"),
    minStock: parseNumberCell(v.minStock, "minStock"),
    reorderLevel: parseNumberCell(v.reorderLevel, "reorderLevel"),
    trackBatch,
    trackExpiry,
    description: v.description || undefined,
  };
}

export function buildCsvTemplate(): string {
  const header = PRODUCT_IMPORT_HEADERS.join(",");
  const sample = PRODUCT_IMPORT_SAMPLE_ROWS.map((row) =>
    PRODUCT_IMPORT_HEADERS.map((key) => escapeCsvCell(row[key] ?? "")).join(","),
  );
  return [header, ...sample].join("\n") + "\n";
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

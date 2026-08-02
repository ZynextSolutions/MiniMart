"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { importProductsAction } from "@/features/products/actions/product.actions";
import {
  PRODUCT_IMPORT_HEADERS,
  PRODUCT_IMPORT_MAX_ROWS,
  buildCsvTemplate,
  type ProductImportResult,
} from "@/features/products/lib/product-import";

interface ProductImportClientProps {
  units: { name: string; abbreviation: string }[];
  categories: { name: string }[];
  brands: { name: string }[];
}

export function ProductImportClient({
  units,
  categories,
  brands,
}: ProductImportClientProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ProductImportResult | null>(null);

  function downloadTemplate() {
    const csv = buildCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "product-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function onFileChange(selected: File | null) {
    setFile(selected);
    setResult(null);
  }

  async function handleImport() {
    if (!file) {
      toast.error("Select a CSV or Excel file first");
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await importProductsAction(formData);

      if (!response.success) {
        toast.error(response.error);
        return;
      }

      setResult(response.result);
      if (response.result.created > 0) {
        toast.success(
          `Imported ${response.result.created} product${response.result.created === 1 ? "" : "s"}`,
        );
        router.refresh();
      } else if (response.result.failed > 0) {
        toast.error("No products were imported. Check the error report below.");
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1. Download template</CardTitle>
            <CardDescription>
              Fill one product per row. Required columns: sku, name, unit,
              sellingPrice. Up to {PRODUCT_IMPORT_MAX_ROWS} rows per import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" variant="secondary" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV template
            </Button>
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">Columns</p>
              <p className="break-all font-mono text-xs">
                {PRODUCT_IMPORT_HEADERS.join(", ")}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-4">
                <li>
                  <span className="text-foreground">unit</span> must match an
                  existing unit name or abbreviation
                  {units.length > 0
                    ? ` (e.g. ${units
                        .slice(0, 4)
                        .map((u) => u.abbreviation)
                        .join(", ")})`
                    : ""}
                </li>
                <li>
                  Optional category / brand / supplier / taxRate match by name
                  {categories.length || brands.length
                    ? ` — you have ${categories.length} categories, ${brands.length} brands`
                    : ""}
                </li>
                <li>Leave barcode blank to auto-generate</li>
                <li>costPrice defaults to 0 if empty</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Upload &amp; import</CardTitle>
            <CardDescription>
              Accepts .csv or .xlsx. Valid rows are created; failed rows are
              reported so you can fix and re-upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/40"
            >
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm">
                {file ? (
                  <>
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB — click to change
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground">
                      Choose CSV or Excel file
                    </p>
                    <p className="text-muted-foreground">Max 5 MB</p>
                  </>
                )}
              </div>
            </button>

            <Button
              type="button"
              className="w-full"
              disabled={!file || importing}
              onClick={handleImport}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import products
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Import results</CardTitle>
            <CardDescription>
              {result.created} created · {result.failed} failed · {result.total}{" "}
              total
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">{result.created} created</Badge>
              {result.failed > 0 && (
                <Badge variant="destructive">{result.failed} failed</Badge>
              )}
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.results.map((row) => (
                    <TableRow key={`${row.rowNumber}-${row.sku}`}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.sku || "—"}
                      </TableCell>
                      <TableCell>{row.name || "—"}</TableCell>
                      <TableCell>
                        {row.success ? (
                          <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            Created
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm text-destructive">
                            <XCircle className="h-4 w-4" />
                            Failed
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.success ? "OK" : row.error}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {result.created > 0 && (
              <Button asChild>
                <Link href="/products">View products</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarcodeCanvas, barcodeToDataUrl } from "./barcode-canvas";
import {
  generateBarcodeCodeAction,
  searchProductsForLabelsAction,
} from "@/features/barcode/actions/barcode.actions";
import {
  LABEL_TEMPLATES,
  type BarcodeFormat,
  type LabelTemplate,
} from "@/lib/services/barcode-label.constants";
import { formatMoney } from "@/lib/utils/format";

interface LabelProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  barcode: string;
  barcodeFormat: BarcodeFormat;
  copies: number;
}

interface LabelDesignerClientProps {
  initialProducts: {
    id: string;
    sku: string;
    name: string;
    price: number;
    barcode: string;
    barcodeType: string;
  }[];
}

function mapFormat(type: string): BarcodeFormat {
  if (type === "EAN13") return "EAN13";
  if (type === "QR") return "QR";
  return "CODE128";
}

export function LabelDesignerClient({ initialProducts }: LabelDesignerClientProps) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState(initialProducts);
  const [selected, setSelected] = useState<LabelProduct[]>([]);
  const [template, setTemplate] = useState<LabelTemplate>("label-40x30");
  const [customCode, setCustomCode] = useState("");
  const [previewCode, setPreviewCode] = useState("8901234567890");
  const [previewFormat, setPreviewFormat] = useState<BarcodeFormat>("EAN13");
  const [printing, setPrinting] = useState(false);

  async function handleSearch() {
    const results = await searchProductsForLabelsAction(search || undefined);
    setProducts(results);
  }

  function toggleProduct(p: (typeof products)[0], checked: boolean) {
    if (checked) {
      setSelected((prev) => [
        ...prev,
        {
          id: p.id,
          sku: p.sku,
          name: p.name,
          price: p.price,
          barcode: p.barcode,
          barcodeFormat: mapFormat(p.barcodeType),
          copies: 1,
        },
      ]);
    } else {
      setSelected((prev) => prev.filter((s) => s.id !== p.id));
    }
  }

  function isSelected(id: string) {
    return selected.some((s) => s.id === id);
  }

  async function generatePreview(type: "EAN13" | "CODE128" | "QR") {
    if (type === "QR") {
      setPreviewFormat("QR");
      setPreviewCode(customCode || "https://minimart.com/product/demo");
      return;
    }
    const result = await generateBarcodeCodeAction(type, customCode || undefined);
    if (result.success && result.code) {
      setPreviewCode(result.code);
      setPreviewFormat(result.format ?? "CODE128");
    } else {
      toast.error(result.error ?? "Generation failed");
    }
  }

  const printLabels = useCallback(async () => {
    if (selected.length === 0) {
      toast.error("Select at least one product");
      return;
    }

    setPrinting(true);
    try {
      const t = LABEL_TEMPLATES[template];
      const expanded: LabelProduct[] = [];
      for (const item of selected) {
        for (let i = 0; i < item.copies; i++) expanded.push(item);
      }

      const labelHtmlParts: string[] = [];
      for (const item of expanded) {
        const imgDataUrl = await barcodeToDataUrl(item.barcode, item.barcodeFormat);
        labelHtmlParts.push(`
          <div class="label" style="width:${t.widthMm}mm;height:${t.heightMm}mm">
            <div class="label-name">${escapeHtml(item.name.slice(0, 28))}</div>
            <div class="label-price">${escapeHtml(formatMoney(item.price))}</div>
            <img class="label-barcode" src="${imgDataUrl}" alt="barcode" />
            <div class="label-sku">${escapeHtml(item.sku)} · ${escapeHtml(item.barcode)}</div>
          </div>`);
      }

      const pageRule = t.pageSize
        ? `@page { size: ${t.pageSize}; margin: 5mm; }`
        : `@page { size: ${t.widthMm}mm ${t.heightMm}mm; margin: 0; }`;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Labels</title>
        <style>
          ${pageRule}
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; }
          .sheet { display: grid; grid-template-columns: repeat(${t.cols}, ${t.widthMm}mm); gap: 2mm; }
          .label { border: 1px dashed #ccc; padding: 2mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; page-break-inside: avoid; }
          .label-name { font-size: 8pt; font-weight: bold; text-align: center; }
          .label-price { font-size: 10pt; font-weight: bold; }
          .label-barcode { max-width: 100%; max-height: 14mm; object-fit: contain; }
          .label-sku { font-size: 6pt; color: #333; }
          @media print { .label { border: none; } }
        </style></head><body><div class="sheet">${labelHtmlParts.join("")}</div></body></html>`;

      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
      }
    } catch {
      toast.error("Failed to prepare labels for printing");
    } finally {
      setPrinting(false);
    }
  }, [selected, template]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold mb-2">Barcode Generator</h2>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Custom code (optional)"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => generatePreview("CODE128")}>
                Code128
              </Button>
              <Button size="sm" variant="outline" onClick={() => generatePreview("EAN13")}>
                EAN13
              </Button>
              <Button size="sm" variant="outline" onClick={() => generatePreview("QR")}>
                QR Code
              </Button>
            </div>
            <div className="flex justify-center rounded-md bg-white p-4 border">
              <BarcodeCanvas value={previewCode} format={previewFormat} height={60} />
            </div>
            <p className="text-center text-sm font-mono text-muted-foreground">{previewCode}</p>
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Select Products</h2>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button variant="outline" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="rounded-md border max-h-64 overflow-y-auto divide-y">
            {products.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={isSelected(p.id)}
                  onCheckedChange={(c) => toggleProduct(p, !!c)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.sku} · {p.barcode} · {formatMoney(p.price)}
                  </p>
                </div>
                <Badge variant="outline">{mapFormat(p.barcodeType)}</Badge>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="font-semibold mb-2">Label Designer</h2>
          <div className="space-y-3 rounded-lg border p-4">
            <div className="space-y-1">
              <Label>Template</Label>
              <Select value={template} onValueChange={(v) => setTemplate(v as LabelTemplate)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LABEL_TEMPLATES).map(([key, t]) => (
                    <SelectItem key={key} value={key}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Selected ({selected.length})</Label>
              {selected.length === 0 ? (
                <p className="text-sm text-muted-foreground">No products selected</p>
              ) : (
                selected.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm border rounded p-2">
                    <span className="flex-1 truncate">{item.name}</span>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      className="w-16 h-8"
                      value={item.copies}
                      onChange={(e) =>
                        setSelected((prev) =>
                          prev.map((s) =>
                            s.id === item.id
                              ? { ...s, copies: parseInt(e.target.value, 10) || 1 }
                              : s,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSelected((prev) => prev.filter((s) => s.id !== item.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <Button className="w-full" onClick={printLabels} disabled={printing || selected.length === 0}>
              <Printer className="mr-2 h-4 w-4" />
              Print Labels
            </Button>
          </div>
        </div>

        {selected[0] && (
          <div>
            <h2 className="font-semibold mb-2">Preview</h2>
            <div
              className="rounded-lg border bg-white p-3 mx-auto flex flex-col items-center justify-between"
              style={{
                width: `${LABEL_TEMPLATES[template].widthMm}mm`,
                height: `${LABEL_TEMPLATES[template].heightMm}mm`,
              }}
            >
              <p className="text-[8pt] font-bold text-center leading-tight">
                {selected[0].name.slice(0, 28)}
              </p>
              <p className="text-[10pt] font-bold">{formatMoney(selected[0].price)}</p>
              <BarcodeCanvas
                value={selected[0].barcode}
                format={selected[0].barcodeFormat}
                height={40}
                className="max-w-full"
              />
              <p className="text-[6pt] text-muted-foreground">
                {selected[0].sku} · {selected[0].barcode}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

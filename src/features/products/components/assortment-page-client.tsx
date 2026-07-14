"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { formatMoney } from "@/lib/utils/format";
import {
  clearAssortmentAction,
  enableAllAssortmentAction,
  getAssortmentCatalogueAction,
  setAssortmentVariantAction,
} from "@/features/products/actions/assortment.actions";
import type {
  AssortmentCatalogue,
  AssortmentItem,
} from "@/features/products/services/assortment.service";

interface AssortmentPageClientProps {
  branches: { id: string; name: string; code: string }[];
  initialBranchId: string;
  initialCatalogue: AssortmentCatalogue;
}

export function AssortmentPageClient({
  branches,
  initialBranchId,
  initialCatalogue,
}: AssortmentPageClientProps) {
  const [branchId, setBranchId] = useState(initialBranchId);
  const [catalogue, setCatalogue] = useState(initialCatalogue);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  async function reload(nextBranchId = branchId, nextSearch = search) {
    const data = await getAssortmentCatalogueAction(nextBranchId, nextSearch);
    setCatalogue(data);
    setPriceDrafts({});
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        void reload(branchId, search);
      });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on branch/search only
  }, [branchId, search]);

  function handleBranchChange(next: string) {
    setBranchId(next);
  }

  async function handleToggle(item: AssortmentItem, isActive: boolean) {
    const result = await setAssortmentVariantAction({
      branchId,
      variantId: item.variantId,
      isActive,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(isActive ? "Product enabled" : "Product disabled");
    await reload();
  }

  async function handlePriceSave(item: AssortmentItem) {
    const raw = priceDrafts[item.variantId];
    if (raw === undefined) return;
    const trimmed = raw.trim();
    const sellingPrice =
      trimmed === "" ? null : Number.parseFloat(trimmed.replace(/,/g, ""));
    if (sellingPrice != null && (Number.isNaN(sellingPrice) || sellingPrice < 0)) {
      toast.error("Enter a valid price");
      return;
    }
    const result = await setAssortmentVariantAction({
      branchId,
      variantId: item.variantId,
      sellingPrice,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(sellingPrice == null ? "Branch price cleared" : "Branch price saved");
    await reload();
  }

  async function handleEnableAll() {
    const result = await enableAllAssortmentAction(branchId);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Assortment restricted to ${result.count} products`);
    await reload();
  }

  async function handleClear() {
    const result = await clearAssortmentAction(branchId);
    setConfirmClear(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Branch now uses the full organisation catalogue");
    await reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branch assortment</h1>
          <p className="text-muted-foreground">
            Control which products each branch can sell and optional local prices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {catalogue.mode === "open" ? (
            <Badge variant="secondary">Open catalogue</Badge>
          ) : (
            <Badge>
              Restricted · {catalogue.activeCount}/{catalogue.totalCount}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={branchId} onValueChange={handleBranchChange}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name} ({b.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEnableAll} disabled={pending}>
            Enable all
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfirmClear(true)}
            disabled={pending || catalogue.mode === "open"}
          >
            Clear restriction
          </Button>
        </div>
      </div>

      {catalogue.mode === "open" && (
        <p className="text-sm text-muted-foreground">
          This branch can sell every active product. Use Enable all or change a
          product toggle/price to start a restricted assortment.
        </p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Base price</TableHead>
              <TableHead>Branch price</TableHead>
              <TableHead className="w-[100px]">Sellable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalogue.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              catalogue.items.map((item) => {
                const draft =
                  priceDrafts[item.variantId] ??
                  (item.sellingPriceOverride != null
                    ? String(item.sellingPriceOverride)
                    : "");
                return (
                  <TableRow key={item.variantId}>
                    <TableCell>
                      <div className="font-medium">{item.productName}</div>
                      {item.variantName !== item.productName && (
                        <div className="text-xs text-muted-foreground">
                          {item.variantName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(item.baseSellingPrice)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-8 w-28"
                          inputMode="decimal"
                          placeholder="—"
                          value={draft}
                          onChange={(e) =>
                            setPriceDrafts((prev) => ({
                              ...prev,
                              [item.variantId]: e.target.value,
                            }))
                          }
                          onBlur={() => {
                            const current =
                              item.sellingPriceOverride != null
                                ? String(item.sellingPriceOverride)
                                : "";
                            if ((priceDrafts[item.variantId] ?? current) !== current) {
                              void handlePriceSave(item);
                            }
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={item.isActive}
                        onCheckedChange={(checked) =>
                          void handleToggle(item, checked)
                        }
                        disabled={pending}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear assortment restriction?"
        description="This branch will sell the full organisation catalogue again. Branch price overrides will be removed."
        confirmLabel="Clear restriction"
        onConfirm={handleClear}
      />
    </div>
  );
}

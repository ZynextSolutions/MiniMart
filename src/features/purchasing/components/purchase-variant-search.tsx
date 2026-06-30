"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchVariantsForPurchasingAction } from "@/features/purchasing/actions/purchasing.actions";

export interface PurchaseVariantOption {
  id: string;
  sku: string;
  name: string;
  costPrice: { toString(): string };
  product: { name: string; unit: { abbreviation: string } };
}

interface PurchaseVariantSearchProps {
  onSelect: (variant: PurchaseVariantOption) => void;
}

export function PurchaseVariantSearch({ onSelect }: PurchaseVariantSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PurchaseVariantOption[]>([]);
  const [open, setOpen] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const data = await searchVariantsForPurchasingAction(q);
    setResults(data as PurchaseVariantOption[]);
    setOpen(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 pr-9"
          placeholder="Search product..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md">
          {results.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(v);
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
              >
                <div className="font-medium">{v.product.name}</div>
                <div className="text-muted-foreground">{v.sku}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchVariantsAction } from "@/features/inventory/actions/inventory.actions";

export interface VariantOption {
  id: string;
  sku: string;
  name: string;
  costPrice: { toString(): string };
  product: {
    name: string;
    trackBatch: boolean;
    trackExpiry: boolean;
    unit: { abbreviation: string };
  };
}

interface VariantSearchInputProps {
  onSelect: (variant: VariantOption) => void;
  placeholder?: string;
}

export function VariantSearchInput({
  onSelect,
  placeholder = "Search product by name, SKU, or barcode...",
}: VariantSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const data = await searchVariantsAction(q);
    setResults(data as VariantOption[]);
    setLoading(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  function handleSelect(variant: VariantOption) {
    onSelect(variant);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 pr-9"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
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
              setOpen(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {open && (results.length > 0 || loading) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Searching...</div>
          ) : (
            <ul className="max-h-60 overflow-auto py-1">
              {results.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => handleSelect(v)}
                  >
                    <div className="font-medium">{v.product.name}</div>
                    <div className="text-muted-foreground">
                      {v.sku} · {v.name}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

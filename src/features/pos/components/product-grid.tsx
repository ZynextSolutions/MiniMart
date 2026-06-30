"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils/format";
import type { ProductLookup } from "@/features/pos/stores/pos-cart-store";

interface ProductGridProps {
  onAddProduct: (product: ProductLookup) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

interface ApiProduct {
  id: string;
  sku: string;
  name: string;
  sellingPrice: string;
  unit: string;
  imageUrl: string | null;
  barcode: string | null;
  variantId: string | null;
  taxRate: string | null;
}

export function ProductGrid({ onAddProduct, searchInputRef }: ProductGridProps) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setProducts([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/products/search?q=${encodeURIComponent(q)}&limit=24`);
      if (res.ok) {
        setProducts(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  function handleAdd(p: ApiProduct) {
    if (!p.variantId) return;
    onAddProduct({
      productId: p.id,
      variantId: p.variantId,
      name: p.name,
      sku: p.sku,
      sellingPrice: parseFloat(p.sellingPrice),
      taxRate: p.taxRate ? parseFloat(p.taxRate) : 0,
      unit: p.unit,
      imageUrl: p.imageUrl,
      barcode: p.barcode,
    });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          className="pl-9 h-11 text-base"
          placeholder="Search products (F1)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Searching...</p>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {query ? "No products found" : "Search or scan to add items"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleAdd(p)}
                className="flex flex-col rounded-lg border bg-card p-2 text-left transition-colors hover:bg-accent active:scale-[0.98]"
              >
                <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-md bg-muted">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <span className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</span>
                <span className="mt-1 text-sm font-bold text-primary">
                  {formatMoney(parseFloat(p.sellingPrice))}
                </span>
                <span className="text-xs text-muted-foreground">{p.sku}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

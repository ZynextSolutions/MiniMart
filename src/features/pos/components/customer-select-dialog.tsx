"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchCustomersAction } from "@/features/pos/actions/pos.actions";
import { usePosCartStore } from "@/features/pos/stores/pos-cart-store";

interface CustomerSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CustomerRow {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  loyaltyPoints: { toString(): string };
}

export function CustomerSelectDialog({ open, onOpenChange }: CustomerSelectDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerRow[]>([]);
  const setCustomer = usePosCartStore((s) => s.setCustomer);

  async function search() {
    const data = await searchCustomersAction(query);
    setResults(data as CustomerRow[]);
  }

  function select(customer: CustomerRow | null) {
    setCustomer(customer?.id ?? null, customer?.name ?? null);
    onOpenChange(false);
    setQuery("");
    setResults([]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Customer (F9)</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="Search name, phone, code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <Button onClick={search}>Search</Button>
        </div>
        <Button variant="ghost" onClick={() => select(null)}>
          Walk-in Customer
        </Button>
        <div className="max-h-60 overflow-auto space-y-1">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full rounded-md border p-2 text-left hover:bg-accent"
              onClick={() => select(c)}
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">
                {c.code} {c.phone ? `· ${c.phone}` : ""} · {Number(c.loyaltyPoints)} pts
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

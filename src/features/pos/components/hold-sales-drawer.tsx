"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deleteHoldAction, listHoldsAction } from "@/features/pos/actions/pos.actions";
import { usePosCartStore, type CartItem } from "@/features/pos/stores/pos-cart-store";

interface HoldSalesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HoldRow {
  id: string;
  holdNumber: string;
  createdAt: Date;
  cartData: unknown;
}

export function HoldSalesDrawer({ open, onOpenChange }: HoldSalesDrawerProps) {
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [loading, setLoading] = useState(false);
  const loadCart = usePosCartStore((s) => s.loadCart);
  const cartItems = usePosCartStore((s) => s.items);

  async function refresh() {
    setLoading(true);
    const data = await listHoldsAction();
    setHolds(data as HoldRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  async function handleResume(hold: HoldRow) {
    if (cartItems.length > 0) {
      const proceed = window.confirm(
        "Your current cart will be replaced by the held sale. Continue?",
      );
      if (!proceed) return;
    }

    const data = hold.cartData as {
      items: CartItem[];
      customerId?: string | null;
      customerName?: string | null;
      couponCode?: string | null;
      couponDiscount?: number;
      orderDiscount?: { type: "PERCENT" | "FIXED"; value: number } | null;
    };

    if (!data.items?.length) {
      toast.error("Held sale has no items");
      return;
    }

    const result = await deleteHoldAction(hold.id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to resume held sale");
      return;
    }

    loadCart(data);
    toast.success(`Resumed ${hold.holdNumber}`);
    onOpenChange(false);
  }

  async function handleDelete(id: string) {
    const result = await deleteHoldAction(id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to delete hold");
      return;
    }
    toast.success("Hold removed");
    refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Held Sales</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : holds.length === 0 ? (
            <p className="text-muted-foreground">No held sales</p>
          ) : (
            holds.map((hold) => {
              const cart = hold.cartData as { items?: { length: number }[] };
              const itemCount = cart?.items?.length ?? 0;
              return (
                <div key={hold.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">{hold.holdNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {itemCount} items · {new Date(hold.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleResume(hold)}>
                      Resume
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(hold.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

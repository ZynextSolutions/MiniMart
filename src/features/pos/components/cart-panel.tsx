"use client";

import { Minus, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/utils/format";
import { getLineTotal, usePosCartStore } from "@/features/pos/stores/pos-cart-store";

interface CartPanelProps {
  onPay: () => void;
  onHold: () => void;
  onSelectCustomer: () => void;
  onDiscount: () => void;
  onClear: () => void;
}

export function CartPanel({
  onPay,
  onHold,
  onSelectCustomer,
  onDiscount,
  onClear,
}: CartPanelProps) {
  const {
    items,
    customerName,
    selectedLineId,
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
    taxMode,
    updateQty,
    removeItem,
    selectLine,
  } = usePosCartStore();

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="font-semibold">Cart ({items.length})</h2>
        <Button variant="ghost" size="sm" onClick={onSelectCustomer}>
          <User className="mr-1 h-4 w-4" />
          {customerName ?? "Customer"}
        </Button>
      </div>

      <ScrollArea className="flex-1 p-2">
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Cart is empty</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.lineId}
                className={`rounded-md border p-2 ${
                  selectedLineId === item.lineId ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => selectLine(item.lineId)}
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(item.unitPrice)} / {item.unit}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatMoney(getLineTotal(item, taxMode))}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQty(item.lineId, item.quantity - 1);
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQty(item.lineId, item.quantity + 1);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.lineId);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-3 space-y-2">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {taxMode === "INCLUSIVE" ? "Total Price" : "Subtotal"}
            </span>
            <span>{formatMoney(taxMode === "INCLUSIVE" ? grandTotal : subtotal)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-{formatMoney(discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatMoney(taxTotal)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatMoney(grandTotal)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onDiscount} disabled={items.length === 0}>
            Discount
          </Button>
          <Button variant="outline" onClick={onHold} disabled={items.length === 0}>
            Hold
            <span className="ml-1 hidden lg:inline text-muted-foreground">(F2)</span>
          </Button>
          <Button variant="outline" onClick={onClear} disabled={items.length === 0}>
            Clear
          </Button>
          <Button className="col-span-1" onClick={onPay} disabled={items.length === 0} size="lg">
            Pay
            <span className="ml-1 hidden lg:inline text-primary-foreground/80">(F4)</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

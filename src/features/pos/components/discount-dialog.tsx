"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { validateCouponAction } from "@/features/pos/actions/pos.actions";
import { usePosCartStore } from "@/features/pos/stores/pos-cart-store";

interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiscountDialog({ open, onOpenChange }: DiscountDialogProps) {
  const { subtotal, couponCode, applyOrderDiscount, setCoupon, selectedLineId, applyLineDiscount } =
    usePosCartStore();

  const [scope, setScope] = useState<"order" | "line" | "coupon">("order");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("");
  const [coupon, setCouponInput] = useState(couponCode ?? "");

  async function handleApply() {
    const numValue = parseFloat(value) || 0;

    if (scope === "coupon") {
      const result = await validateCouponAction(coupon, subtotal);
      if (result.success) {
        setCoupon(coupon, result.discountAmount);
        toast.success("Coupon applied");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
      return;
    }

    if (scope === "order") {
      applyOrderDiscount(numValue > 0 ? { type, value: numValue } : null);
    } else if (selectedLineId) {
      applyLineDiscount(selectedLineId, numValue > 0 ? { type, value: numValue } : null);
    } else {
      toast.error("Select a cart line first");
      return;
    }

    toast.success("Discount applied");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Discount (F8)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order">Order Discount</SelectItem>
                <SelectItem value="line">Line Discount</SelectItem>
                <SelectItem value="coupon">Coupon Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "coupon" ? (
            <div className="space-y-2">
              <Label>Coupon Code</Label>
              <Input value={coupon} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                    <SelectItem value="FIXED">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              {scope === "line" && !selectedLineId && (
                <p className="text-sm text-amber-600">Select a line in the cart first</p>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (scope === "order") applyOrderDiscount(null);
              if (scope === "coupon") setCoupon(null, 0);
              onOpenChange(false);
            }}
          >
            Clear
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

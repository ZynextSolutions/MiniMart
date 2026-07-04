"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCouponAction,
  createPromotionAction,
} from "@/features/promotions/actions/promotion.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Promo = {
  id: string;
  name: string;
  code: string | null;
  discountType: string;
  discountValue: string;
  isActive: boolean;
};

type Coupon = {
  id: string;
  code: string;
  discountType: string;
  discountValue: string;
  usedCount: number;
  maxUses: number | null;
  isActive: boolean;
};

export function PromotionsClient({
  promotions,
  coupons,
}: {
  promotions: Promo[];
  coupons: Coupon[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handlePromotion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const result = await createPromotionAction({
      name: String(form.get("name")),
      code: String(form.get("code") || ""),
      discountType: String(form.get("discountType")) as "PERCENTAGE" | "FIXED",
      discountValue: Number(form.get("discountValue")),
      startDate: String(form.get("startDate")),
      endDate: String(form.get("endDate")),
    });
    setSaving(false);
    if (result.success) {
      toast.success("Promotion created");
      router.refresh();
    } else toast.error(result.error);
  }

  async function handleCoupon(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const result = await createCouponAction({
      code: String(form.get("code")),
      discountType: String(form.get("discountType")) as "PERCENTAGE" | "FIXED",
      discountValue: Number(form.get("discountValue")),
      maxUses: form.get("maxUses") ? Number(form.get("maxUses")) : undefined,
      startDate: String(form.get("startDate")),
      endDate: String(form.get("endDate")),
    });
    setSaving(false);
    if (result.success) {
      toast.success("Coupon created");
      router.refresh();
    } else toast.error(result.error);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Promotions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handlePromotion} className="space-y-3">
            <Input name="name" placeholder="Promotion name" required />
            <Input name="code" placeholder="Code (optional)" />
            <div className="grid grid-cols-2 gap-2">
              <select name="discountType" className="h-10 rounded-md border px-3 text-sm" defaultValue="PERCENTAGE">
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed</option>
              </select>
              <Input name="discountValue" type="number" placeholder="Value" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input name="startDate" type="date" required />
              <Input name="endDate" type="date" required />
            </div>
            <Button type="submit" disabled={saving}>Add promotion</Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.discountValue} {p.discountType}</TableCell>
                  <TableCell>{p.isActive ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Coupons</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCoupon} className="space-y-3">
            <Input name="code" placeholder="Coupon code" required />
            <div className="grid grid-cols-2 gap-2">
              <select name="discountType" className="h-10 rounded-md border px-3 text-sm" defaultValue="PERCENTAGE">
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed</option>
              </select>
              <Input name="discountValue" type="number" placeholder="Value" required />
            </div>
            <Input name="maxUses" type="number" placeholder="Max uses (optional)" />
            <div className="grid grid-cols-2 gap-2">
              <Input name="startDate" type="date" required />
              <Input name="endDate" type="date" required />
            </div>
            <Button type="submit" disabled={saving}>Add coupon</Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.code}</TableCell>
                  <TableCell>{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}</TableCell>
                  <TableCell>{c.isActive ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

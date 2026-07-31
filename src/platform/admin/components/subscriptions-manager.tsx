"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateSubscriptionAction } from "@/platform/admin/platform.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type PlanOption = { id: string; name: string; slug: string };

type Subscription = {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  organization: { id: string; name: string; slug: string };
  plan: { name: string };
};

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function SubscriptionsManager({
  subscriptions,
  plans,
}: {
  subscriptions: Subscription[];
  plans: PlanOption[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleUpdate(
    id: string,
    data: {
      planId?: string;
      status?: string;
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
      trialEndsAt?: string | null;
    },
  ) {
    setSaving(true);
    const result = await updateSubscriptionAction({
      id,
      planId: data.planId,
      status: data.status as "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | undefined,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      trialEndsAt: data.trialEndsAt,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Subscription updated");
      setEditingId(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handlePeriodSave(
    e: React.FormEvent<HTMLFormElement>,
    sub: Subscription,
  ) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const currentPeriodStart = String(form.get("currentPeriodStart") || "");
    const currentPeriodEnd = String(form.get("currentPeriodEnd") || "");
    const trialEndsRaw = String(form.get("trialEndsAt") || "");
    await handleUpdate(sub.id, {
      currentPeriodStart,
      currentPeriodEnd,
      trialEndsAt: trialEndsRaw ? trialEndsRaw : null,
    });
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Period</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub) => (
            <TableRow key={sub.id} className="align-top">
              <TableCell>
                <Link
                  href={`/platform/organizations/${sub.organization.id}`}
                  className="font-medium hover:underline"
                >
                  {sub.organization.name}
                </Link>
              </TableCell>
              <TableCell>
                {editingId === sub.id ? (
                  <Select
                    defaultValue={plans.find((p) => p.name === sub.plan.name)?.id}
                    onValueChange={(planId) => handleUpdate(sub.id, { planId })}
                    disabled={saving}
                  >
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  sub.plan.name
                )}
              </TableCell>
              <TableCell>
                {editingId === sub.id ? (
                  <Select
                    defaultValue={sub.status}
                    onValueChange={(status) => handleUpdate(sub.id, { status })}
                    disabled={saving}
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRIAL">Trial</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="PAST_DUE">Past Due</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge>{sub.status}</Badge>
                )}
              </TableCell>
              <TableCell>
                {editingId === sub.id ? (
                  <form
                    onSubmit={(e) => handlePeriodSave(e, sub)}
                    className="grid min-w-[16rem] gap-2"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs">Start</Label>
                      <Input
                        name="currentPeriodStart"
                        type="date"
                        required
                        defaultValue={toDateInputValue(sub.currentPeriodStart)}
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End</Label>
                      <Input
                        name="currentPeriodEnd"
                        type="date"
                        required
                        defaultValue={toDateInputValue(sub.currentPeriodEnd)}
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Trial ends</Label>
                      <Input
                        name="trialEndsAt"
                        type="date"
                        defaultValue={toDateInputValue(sub.trialEndsAt)}
                        disabled={saving}
                      />
                    </div>
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? "Saving..." : "Save dates"}
                    </Button>
                  </form>
                ) : (
                  <div className="text-sm">
                    <div>
                      {new Date(sub.currentPeriodStart).toLocaleDateString()} –{" "}
                      {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </div>
                    {sub.trialEndsAt ? (
                      <div className="text-muted-foreground">
                        Trial: {new Date(sub.trialEndsAt).toLocaleDateString()}
                      </div>
                    ) : null}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingId(editingId === sub.id ? null : sub.id)}
                >
                  {editingId === sub.id ? "Done" : "Edit"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

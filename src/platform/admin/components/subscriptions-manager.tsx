"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateSubscriptionAction } from "@/platform/admin/platform.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  organization: { id: string; name: string; slug: string };
  plan: { name: string };
};

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
    data: { planId?: string; status?: string },
  ) {
    setSaving(true);
    const result = await updateSubscriptionAction({
      id,
      planId: data.planId,
      status: data.status as "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | undefined,
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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Period End</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub) => (
            <TableRow key={sub.id}>
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
              <TableCell>{new Date(sub.currentPeriodEnd).toLocaleDateString()}</TableCell>
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

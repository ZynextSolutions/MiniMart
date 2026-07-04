"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteOrganizationAction,
  updateOrganizationAction,
  updateOrganizationStatusAction,
  updateSubscriptionAction,
} from "@/platform/admin/platform.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PlanOption = { id: string; name: string };

type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  country: string;
  currency: string;
  timezone: string;
  status: string;
  createdAt: string;
  _count: { users: number; branches: number; products: number; warehouses: number };
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    plan: { id: string; name: string };
    events: { id: string; status: string; note: string | null; createdAt: string }[];
  } | null;
};

export function OrganizationDetailClient({
  org,
  plans,
}: {
  org: OrgDetail;
  plans: PlanOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const result = await updateOrganizationAction({
      id: org.id,
      name: String(form.get("name")),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      country: String(form.get("country")),
      currency: String(form.get("currency")),
      timezone: String(form.get("timezone")),
    });
    setSaving(false);
    if (result.success) {
      toast.success("Organization updated");
      setEditing(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleStatusChange(status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED") {
    const result = await updateOrganizationStatusAction({
      organizationId: org.id,
      status,
    });
    if (result.success) {
      toast.success("Status updated");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleSubscriptionUpdate(data: { planId?: string; status?: string }) {
    if (!org.subscription) return;
    const result = await updateSubscriptionAction({
      id: org.subscription.id,
      planId: data.planId,
      status: data.status as "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | undefined,
    });
    if (result.success) {
      toast.success("Subscription updated");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteOrganizationAction(org.id);
    setDeleting(false);
    if (result.success) {
      toast.success("Organization deleted");
      router.push("/platform/organizations");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
          <p className="text-muted-foreground">/{org.slug}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={org.status} onValueChange={(v) => handleStatusChange(v as "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="TRIAL">Trial</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Users</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{org._count.users}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Branches</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{org._count.branches}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Products</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{org._count.products}</CardContent>
        </Card>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="rounded-md border p-4 space-y-4 max-w-xl">
          <h3 className="font-semibold">Edit organization</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={org.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={org.email ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={org.phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" defaultValue={org.country} maxLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue={org.currency} maxLength={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" name="timezone" defaultValue={org.timezone} />
            </div>
          </div>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </form>
      ) : (
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <div>Email: {org.email ?? "—"}</div>
            <div>Phone: {org.phone ?? "—"}</div>
            <div>Country: {org.country}</div>
            <div>Currency: {org.currency}</div>
            <div>Timezone: {org.timezone}</div>
            <div>Created: {new Date(org.createdAt).toLocaleDateString()}</div>
          </CardContent>
        </Card>
      )}

      {org.subscription && (
        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={org.subscription.plan.id}
                  onValueChange={(planId) => handleSubscriptionUpdate({ planId })}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={org.subscription.status}
                  onValueChange={(status) => handleSubscriptionUpdate({ status })}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRIAL">Trial</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PAST_DUE">Past Due</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Period: {new Date(org.subscription.currentPeriodStart).toLocaleDateString()} –{" "}
              {new Date(org.subscription.currentPeriodEnd).toLocaleDateString()}
            </div>
            {org.subscription.events.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="text-sm font-medium">Recent events</h4>
                {org.subscription.events.map((event) => (
                  <div key={event.id} className="text-sm text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()} — {event.status}
                    {event.note ? ` (${event.note})` : ""}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

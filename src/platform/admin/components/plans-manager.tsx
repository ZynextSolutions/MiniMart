"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertPlanAction, deletePlanAction } from "@/platform/admin/platform.actions";
import {
  defaultModuleMap,
  modulesForPlanSlug,
  PLATFORM_MODULES,
  type PlatformModuleKey,
} from "@/platform/modules/platform-modules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  billingInterval: string;
  trialDays: number;
  limits: Record<string, number>;
  modules: Record<PlatformModuleKey, boolean>;
  isActive: boolean;
  sortOrder: number;
};

function getPlanModules(plan: Plan | "new", slug: string): Record<PlatformModuleKey, boolean> {
  if (plan === "new") return defaultModuleMap();
  if (plan.modules && Object.keys(plan.modules).length > 0) return plan.modules;
  return modulesForPlanSlug(slug || plan.slug);
}

export function PlansManager({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [moduleState, setModuleState] = useState<Record<PlatformModuleKey, boolean>>(
    defaultModuleMap(),
  );

  const emptyPlan = {
    name: "",
    slug: "",
    description: "",
    price: "0",
    billingInterval: "MONTHLY",
    trialDays: 14,
    limits: { maxBranches: 1, maxUsers: 3, maxProducts: 100 },
    isActive: true,
    sortOrder: plans.length,
  };

  const enabledModuleCount = useMemo(
    () => Object.values(moduleState).filter(Boolean).length,
    [moduleState],
  );

  function openEditor(plan: Plan | "new") {
    setEditing(plan);
    const nextSlug = plan === "new" ? "" : plan.slug;
    setSlug(nextSlug);
    setModuleState(getPlanModules(plan, nextSlug));
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const result = await upsertPlanAction({
      id: editing === "new" ? undefined : editing.id,
      name: String(form.get("name")),
      slug: String(form.get("slug")),
      description: String(form.get("description") || ""),
      price: Number(form.get("price")),
      billingInterval: String(form.get("billingInterval")) as "MONTHLY" | "YEARLY",
      trialDays: Number(form.get("trialDays")),
      maxBranches: Number(form.get("maxBranches")),
      maxUsers: Number(form.get("maxUsers")),
      maxProducts: Number(form.get("maxProducts")),
      modules: moduleState,
      isActive: form.get("isActive") === "on",
      sortOrder: Number(form.get("sortOrder")),
    });
    setSaving(false);
    if (result.success) {
      toast.success(editing === "new" ? "Plan created" : "Plan saved");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deletePlanAction(id);
    setDeletingId(null);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openEditor("new")}>New plan</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Modules</TableHead>
              <TableHead>Trial</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>{plan.slug}</TableCell>
                <TableCell>${plan.price}</TableCell>
                <TableCell>
                  {Object.values(plan.modules ?? {}).filter(Boolean).length} enabled
                </TableCell>
                <TableCell>{plan.trialDays}d</TableCell>
                <TableCell>{plan.isActive ? "Yes" : "No"}</TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => openEditor(plan)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deletingId === plan.id}
                    onClick={() => handleDelete(plan.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="rounded-md border p-4 space-y-4 max-w-3xl">
          <h3 className="font-semibold">
            {editing === "new" ? "New plan" : `Edit ${editing.name}`}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={editing === "new" ? emptyPlan.name : editing.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                defaultValue={editing === "new" ? emptyPlan.slug : editing.slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  if (editing === "new") {
                    setModuleState(modulesForPlanSlug(e.target.value || "starter"));
                  }
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                defaultValue={editing === "new" ? emptyPlan.price : editing.price}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trialDays">Trial days</Label>
              <Input
                id="trialDays"
                name="trialDays"
                type="number"
                defaultValue={editing === "new" ? emptyPlan.trialDays : editing.trialDays}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxBranches">Max branches</Label>
              <Input
                id="maxBranches"
                name="maxBranches"
                type="number"
                defaultValue={
                  editing === "new"
                    ? emptyPlan.limits.maxBranches
                    : editing.limits?.maxBranches ?? 1
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxUsers">Max users</Label>
              <Input
                id="maxUsers"
                name="maxUsers"
                type="number"
                defaultValue={
                  editing === "new"
                    ? emptyPlan.limits.maxUsers
                    : editing.limits?.maxUsers ?? 3
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxProducts">Max products</Label>
              <Input
                id="maxProducts"
                name="maxProducts"
                type="number"
                defaultValue={
                  editing === "new"
                    ? emptyPlan.limits.maxProducts
                    : editing.limits?.maxProducts ?? 100
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input
                id="sortOrder"
                name="sortOrder"
                type="number"
                defaultValue={editing === "new" ? emptyPlan.sortOrder : editing.sortOrder}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              defaultValue={editing === "new" ? "" : editing.description ?? ""}
            />
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Included modules</Label>
                <p className="text-sm text-muted-foreground">
                  Choose which app modules organizations on this plan can access.
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                {enabledModuleCount} of {PLATFORM_MODULES.length} enabled
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PLATFORM_MODULES.map((mod) => (
                <label
                  key={mod.key}
                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                >
                  <Switch
                    checked={moduleState[mod.key]}
                    onCheckedChange={(checked) =>
                      setModuleState((prev) => ({ ...prev, [mod.key]: checked }))
                    }
                  />
                  <span>
                    <span className="font-medium text-sm">{mod.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {mod.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <input
            type="hidden"
            name="billingInterval"
            value={editing === "new" ? emptyPlan.billingInterval : editing.billingInterval}
          />
          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              name="isActive"
              defaultChecked={editing === "new" ? emptyPlan.isActive : editing.isActive}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save plan"}</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

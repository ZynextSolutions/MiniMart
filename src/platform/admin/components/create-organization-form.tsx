"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createOrganizationAction } from "@/platform/admin/platform.actions";
import { slugify } from "@/platform/onboarding/slug";
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

type PlanOption = { slug: string; name: string };

export function CreateOrganizationForm({ plans }: { plans: PlanOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [planSlug, setPlanSlug] = useState(plans[0]?.slug ?? "starter");

  function handleOrgNameChange(value: string) {
    setOrgName(value);
    if (!slugDirty) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const result = await createOrganizationAction({
      organizationName: String(form.get("organizationName")),
      slug: String(form.get("slug")),
      ownerFirstName: String(form.get("ownerFirstName")),
      ownerLastName: String(form.get("ownerLastName")),
      ownerEmail: String(form.get("ownerEmail")),
      ownerPassword: String(form.get("ownerPassword")),
      planSlug,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Organization created");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>Create organization</Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border p-4 space-y-4">
      <h3 className="font-semibold">Create organization</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="organizationName">Business name</Label>
          <Input
            id="organizationName"
            name="organizationName"
            value={orgName}
            onChange={(e) => handleOrgNameChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugDirty(true);
            }}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerFirstName">Owner first name</Label>
          <Input id="ownerFirstName" name="ownerFirstName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerLastName">Owner last name</Label>
          <Input id="ownerLastName" name="ownerLastName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerEmail">Owner email</Label>
          <Input id="ownerEmail" name="ownerEmail" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerPassword">Owner password</Label>
          <Input id="ownerPassword" name="ownerPassword" type="password" minLength={8} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planSlug">Plan</Label>
          <Select value={planSlug} onValueChange={setPlanSlug}>
            <SelectTrigger id="planSlug"><SelectValue /></SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.slug} value={plan.slug}>{plan.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

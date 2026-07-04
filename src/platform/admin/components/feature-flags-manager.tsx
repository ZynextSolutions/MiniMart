"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteFeatureFlagAction,
  removeFeatureFlagOverrideAction,
  setFeatureFlagOverrideAction,
  upsertFeatureFlagAction,
} from "@/platform/admin/platform.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

type OrgOption = { id: string; name: string; slug: string };

type FeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  _count: { overrides: number };
};

type Override = {
  id: string;
  isEnabled: boolean;
  organization: { id: string; name: string; slug: string };
};

export function FeatureFlagsManager({
  flags,
  organizations,
  overridesByFlag,
}: {
  flags: FeatureFlag[];
  organizations: OrgOption[];
  overridesByFlag: Record<string, Override[]>;
}) {
  const router = useRouter();
  const moduleFlags = flags.filter((f) => f.key.startsWith("module."));
  const otherFlags = flags.filter((f) => !f.key.startsWith("module."));
  const [editing, setEditing] = useState<FeatureFlag | "new" | null>(null);
  const [overrideFlag, setOverrideFlag] = useState<FeatureFlag | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [overrideOrgId, setOverrideOrgId] = useState("");

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const result = await upsertFeatureFlagAction({
      key: String(form.get("key")),
      name: String(form.get("name")),
      description: String(form.get("description") || ""),
      isEnabled: form.get("isEnabled") === "on",
    });
    setSaving(false);
    if (result.success) {
      toast.success(editing === "new" ? "Flag created" : "Flag updated");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleToggle(flag: FeatureFlag) {
    const result = await upsertFeatureFlagAction({
      key: flag.key,
      name: flag.name,
      description: flag.description ?? "",
      isEnabled: !flag.isEnabled,
    });
    if (result.success) {
      toast.success(`Flag ${flag.isEnabled ? "disabled" : "enabled"}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteFeatureFlagAction(id);
    setDeletingId(null);
    if (result.success) {
      toast.success("Flag deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleOverride(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!overrideFlag) return;
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const result = await setFeatureFlagOverrideAction({
      key: overrideFlag.key,
      organizationId: overrideOrgId,
      isEnabled: form.get("overrideEnabled") === "on",
    });
    setSaving(false);
    if (result.success) {
      toast.success("Override saved");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleRemoveOverride(overrideId: string) {
    const result = await removeFeatureFlagOverrideAction(overrideId);
    if (result.success) {
      toast.success("Override removed");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border p-4 space-y-2">
        <h3 className="font-semibold">Module access (per organization)</h3>
        <p className="text-sm text-muted-foreground">
          Plan defaults are configured under <strong>Plans</strong>. To override modules for a
          specific organization, open <strong>Organizations → [org] → Module Access</strong> and
          set Inherit / Force enable / Force disable per module.
        </p>
        <p className="text-sm text-muted-foreground">
          Module flags below (`module.*`) store per-org overrides. Global toggle acts as a
          platform-wide kill switch when no org override exists.
        </p>
      </div>

      {moduleFlags.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Module flags</h3>
          <FlagTable
            flags={moduleFlags}
            deletingId={deletingId}
            onEdit={setEditing}
            onOverride={(flag) => {
              setOverrideFlag(flag);
              setOverrideOrgId(organizations[0]?.id ?? "");
            }}
            onDelete={handleDelete}
            onToggle={handleToggle}
            overridesByFlag={overridesByFlag}
          />
        </div>
      )}

      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>New flag</Button>
        </div>
        <FlagTable
          flags={otherFlags}
          deletingId={deletingId}
          onEdit={setEditing}
          onOverride={(flag) => {
            setOverrideFlag(flag);
            setOverrideOrgId(organizations[0]?.id ?? "");
          }}
          onDelete={handleDelete}
          onToggle={handleToggle}
          overridesByFlag={overridesByFlag}
        />
      </div>

      {editing && (
        <form onSubmit={handleSave} className="rounded-md border p-4 space-y-4 max-w-xl">
          <h3 className="font-semibold">
            {editing === "new" ? "New feature flag" : `Edit ${editing.name}`}
          </h3>
          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              name="key"
              defaultValue={editing === "new" ? "" : editing.key}
              disabled={editing !== "new"}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={editing === "new" ? "" : editing.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              defaultValue={editing === "new" ? "" : editing.description ?? ""}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="isEnabled"
              name="isEnabled"
              defaultChecked={editing === "new" ? false : editing.isEnabled}
            />
            <Label htmlFor="isEnabled">Enabled globally</Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}

      {overrideFlag && (
        <div className="rounded-md border p-4 space-y-4 max-w-xl">
          <h3 className="font-semibold">Overrides for {overrideFlag.key}</h3>
          {(overridesByFlag[overrideFlag.id] ?? []).length > 0 ? (
            <div className="space-y-2">
              {(overridesByFlag[overrideFlag.id] ?? []).map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <span>
                    {o.organization.name} — {o.isEnabled ? "On" : "Off"}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveOverride(o.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No org overrides yet.</p>
          )}
          <form onSubmit={handleOverride} className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={overrideOrgId} onValueChange={setOverrideOrgId} required>
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="overrideEnabled" name="overrideEnabled" />
              <Label htmlFor="overrideEnabled">Enabled for this org</Label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>Add override</Button>
              <Button type="button" variant="outline" onClick={() => setOverrideFlag(null)}>Close</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function FlagTable({
  flags,
  deletingId,
  onEdit,
  onOverride,
  onDelete,
  onToggle,
  overridesByFlag,
}: {
  flags: FeatureFlag[];
  deletingId: string | null;
  onEdit: (flag: FeatureFlag | "new") => void;
  onOverride: (flag: FeatureFlag) => void;
  onDelete: (id: string) => void;
  onToggle: (flag: FeatureFlag) => void;
  overridesByFlag: Record<string, Override[]>;
}) {
  if (flags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-md border p-4 text-center">
        No flags in this section.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Global</TableHead>
            <TableHead>Overrides</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {flags.map((flag) => (
            <TableRow key={flag.id}>
              <TableCell className="font-mono text-sm">{flag.key}</TableCell>
              <TableCell>{flag.name}</TableCell>
              <TableCell>
                <Button size="sm" variant="outline" onClick={() => onToggle(flag)}>
                  <Badge variant={flag.isEnabled ? "default" : "secondary"}>
                    {flag.isEnabled ? "On" : "Off"}
                  </Badge>
                </Button>
              </TableCell>
              <TableCell>{flag._count.overrides}</TableCell>
              <TableCell className="space-x-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(flag)}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => onOverride(flag)}>
                  Overrides
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deletingId === flag.id}
                  onClick={() => onDelete(flag.id)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteAnnouncementAction,
  upsertAnnouncementAction,
} from "@/platform/admin/platform.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

type Announcement = {
  id: string;
  title: string;
  message: string;
  type: string;
  organizationId: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export function AnnouncementsManager({
  announcements,
  organizations,
}: {
  announcements: Announcement[];
  organizations: OrgOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [type, setType] = useState<"info" | "warning" | "success" | "error">("info");
  const [organizationId, setOrganizationId] = useState("global");

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const result = await upsertAnnouncementAction({
      id: editing === "new" ? undefined : editing.id,
      title: String(form.get("title")),
      message: String(form.get("message")),
      type,
      organizationId: organizationId === "global" ? null : organizationId,
      isActive: form.get("isActive") === "on",
      startsAt: String(form.get("startsAt") || "") || null,
      endsAt: String(form.get("endsAt") || "") || null,
    });
    setSaving(false);
    if (result.success) {
      toast.success(editing === "new" ? "Announcement created" : "Announcement updated");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteAnnouncementAction(id);
    setDeletingId(null);
    if (result.success) {
      toast.success("Announcement deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing("new"); setType("info"); setOrganizationId("global"); }}>New announcement</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {announcements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No announcements yet.
                </TableCell>
              </TableRow>
            ) : (
              announcements.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell><Badge variant="outline">{a.type}</Badge></TableCell>
                  <TableCell>{a.organizationId ? "Organization" : "Global"}</TableCell>
                  <TableCell>{a.isActive ? "Yes" : "No"}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditing(a);
                      setType(a.type as "info" | "warning" | "success" | "error");
                      setOrganizationId(a.organizationId ?? "global");
                    }}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deletingId === a.id}
                      onClick={() => handleDelete(a.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="rounded-md border p-4 space-y-4 max-w-xl">
          <h3 className="font-semibold">
            {editing === "new" ? "New announcement" : `Edit ${editing.title}`}
          </h3>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={editing === "new" ? "" : editing.title}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              defaultValue={editing === "new" ? "" : editing.message}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "info" | "warning" | "success" | "error")}>
                <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizationId">Scope</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger id="organizationId"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (all orgs)</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startsAt">Starts at</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={
                  editing !== "new" && editing.startsAt
                    ? editing.startsAt.slice(0, 16)
                    : ""
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">Ends at</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={
                  editing !== "new" && editing.endsAt
                    ? editing.endsAt.slice(0, 16)
                    : ""
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              name="isActive"
              defaultChecked={editing === "new" ? true : editing.isActive}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createSupportTicketAction,
  deleteSupportTicketAction,
} from "@/platform/admin/platform.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type SupportTicket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  organization: { name: string; slug: string };
  _count: { messages: number };
};

export function SupportTicketsManager({
  tickets,
  organizations,
}: {
  tickets: SupportTicket[];
  organizations: OrgOption[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const result = await createSupportTicketAction({
      organizationId,
      subject: String(form.get("subject")),
      message: String(form.get("message")),
      priority,
    });
    setSaving(false);
    if (result.success && result.ticketId) {
      toast.success("Ticket created");
      setCreating(false);
      router.push(`/platform/support/${result.ticketId}`);
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteSupportTicketAction(id);
    setDeletingId(null);
    if (result.success) {
      toast.success("Ticket deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setCreating(true); setOrganizationId(organizations[0]?.id ?? ""); }}>New ticket</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Messages</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No support tickets yet.
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <Link
                      href={`/platform/support/${ticket.id}`}
                      className="font-medium hover:underline"
                    >
                      {ticket.subject}
                    </Link>
                  </TableCell>
                  <TableCell>{ticket.organization.name}</TableCell>
                  <TableCell><Badge>{ticket.status}</Badge></TableCell>
                  <TableCell>{ticket.priority}</TableCell>
                  <TableCell>{ticket._count.messages}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/platform/support/${ticket.id}`}>View</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deletingId === ticket.id}
                      onClick={() => handleDelete(ticket.id)}
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

      {creating && (
        <form onSubmit={handleCreate} className="rounded-md border p-4 space-y-4 max-w-xl">
          <h3 className="font-semibold">New support ticket</h3>
          <div className="space-y-2">
            <Label htmlFor="organizationId">Organization</Label>
            <Select value={organizationId} onValueChange={setOrganizationId} required>
              <SelectTrigger id="organizationId"><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" name="message" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as "LOW" | "MEDIUM" | "HIGH" | "URGENT")}>
              <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

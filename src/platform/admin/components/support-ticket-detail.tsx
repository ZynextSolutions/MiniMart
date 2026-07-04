"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addSupportTicketMessageAction,
  deleteSupportTicketAction,
  updateSupportTicketAction,
} from "@/platform/admin/platform.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Message = {
  id: string;
  message: string;
  isFromPlatform: boolean;
  authorName: string;
  authorEmail: string;
  createdAt: string;
};

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdByEmail: string;
  createdByName: string;
  createdAt: string;
  organization: { id: string; name: string; slug: string };
  messages: Message[];
};

export function SupportTicketDetail({ ticket }: { ticket: Ticket }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSaving(true);
    const result = await addSupportTicketMessageAction({
      ticketId: ticket.id,
      message: reply.trim(),
    });
    setSaving(false);
    if (result.success) {
      toast.success("Reply sent");
      setReply("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleUpdate(field: "status" | "priority", value: string) {
    const result = await updateSupportTicketAction({
      id: ticket.id,
      [field]: value,
    });
    if (result.success) {
      toast.success("Ticket updated");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteSupportTicketAction(ticket.id);
    setDeleting(false);
    if (result.success) {
      toast.success("Ticket deleted");
      router.push("/platform/support");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/platform/support" className="text-sm text-muted-foreground hover:underline">
            ← Back to support
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{ticket.subject}</h1>
          <p className="text-muted-foreground">
            {ticket.organization.name} · opened by {ticket.createdByName} ({ticket.createdByEmail})
          </p>
        </div>
        <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
          Delete
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={ticket.status} onValueChange={(v) => handleUpdate("status", v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={ticket.priority} onValueChange={(v) => handleUpdate("priority", v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Badge>{ticket.status}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-md border p-3 ${
                msg.isFromPlatform ? "bg-muted/50" : ""
              }`}
            >
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">
                  {msg.authorName}
                  {msg.isFromPlatform && (
                    <span className="ml-2 text-xs text-muted-foreground">(Platform)</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
            </div>
          ))}

          <form onSubmit={handleReply} className="space-y-2 border-t pt-4">
            <Label htmlFor="reply">Reply</Label>
            <Textarea
              id="reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply..."
              rows={4}
            />
            <Button type="submit" disabled={saving || !reply.trim()}>
              {saving ? "Sending..." : "Send reply"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { notFound } from "next/navigation";
import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import { SupportTicketDetail } from "@/platform/admin/components/support-ticket-detail";

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await PlatformAdminService.getSupportTicket(id);
  if (!ticket) notFound();

  const serializedTicket = {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    createdByEmail: ticket.createdByEmail,
    createdByName: ticket.createdByName,
    createdAt: ticket.createdAt.toISOString(),
    organization: ticket.organization,
    messages: ticket.messages.map((m) => ({
      id: m.id,
      message: m.message,
      isFromPlatform: m.isFromPlatform,
      authorName: m.authorName,
      authorEmail: m.authorEmail,
      createdAt: m.createdAt.toISOString(),
    })),
  };

  return <SupportTicketDetail ticket={serializedTicket} />;
}

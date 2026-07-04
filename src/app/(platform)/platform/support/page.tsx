import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import { SupportTicketsManager } from "@/platform/admin/components/support-tickets-manager";

export default async function PlatformSupportPage() {
  const [data, organizations] = await Promise.all([
    PlatformAdminService.listSupportTickets(),
    PlatformAdminService.listOrganizationOptions(),
  ]);

  const serializedTickets = data.items.map((ticket) => ({
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt.toISOString(),
    organization: ticket.organization,
    _count: ticket._count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
        <p className="text-muted-foreground">Customer support inbox.</p>
      </div>
      <SupportTicketsManager tickets={serializedTickets} organizations={organizations} />
    </div>
  );
}

import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PlatformDashboardPage() {
  const stats = await PlatformAdminService.getDashboardStats();

  const cards = [
    { title: "Organizations", value: stats.totalOrgs },
    { title: "Active Trials", value: stats.activeTrials },
    { title: "Active Subscriptions", value: stats.activeSubscriptions },
    { title: "Suspended Orgs", value: stats.suspendedOrgs },
    { title: "Total Users", value: stats.totalUsers },
    { title: "Open Tickets", value: stats.openTickets },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of all organizations and platform health.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

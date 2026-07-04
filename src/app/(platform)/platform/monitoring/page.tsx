import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlatformMonitoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Monitoring</h1>
        <p className="text-muted-foreground">Health checks and job queue status.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">API Health</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>Healthy</Badge>
            <p className="mt-2 text-sm text-muted-foreground">
              GET /api/v1/health — operational
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Background Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Not configured</Badge>
            <p className="mt-2 text-sm text-muted-foreground">
              BullMQ worker will be added in production deployment.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

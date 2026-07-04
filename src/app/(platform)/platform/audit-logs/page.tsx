import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PlatformAuditLogsPage() {
  const data = await PlatformAdminService.listAuditLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Audit Logs</h1>
        <p className="text-muted-foreground">Cross-tenant administrative actions.</p>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{log.createdAt.toLocaleString()}</TableCell>
                <TableCell>
                  {log.platformUser
                    ? `${log.platformUser.firstName} ${log.platformUser.lastName}`
                    : "System"}
                </TableCell>
                <TableCell>{log.action}</TableCell>
                <TableCell>{log.entityType}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

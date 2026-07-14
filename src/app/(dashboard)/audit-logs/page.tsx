import { authorizeSession, requireSession } from "@/lib/auth/session";
import { resolveSessionBranchFilter } from "@/lib/auth/branch-access";
import { getUserBranches } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/infrastructure/database/prisma";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardBranchFilter } from "@/features/dashboard/components/dashboard-branch-filter";

interface Props {
  searchParams: Promise<{ branchId?: string }>;
}

export default async function AuditLogsPage({ searchParams }: Props) {
  const session = await requireSession();
  await authorizeSession(session, PERMISSIONS.AUDIT.VIEW);
  const params = await searchParams;
  const branchFilter = resolveSessionBranchFilter(session.user, params.branchId);
  const branches = await getUserBranches(session.user.id);

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId: session.user.organizationId,
      OR: [
        { branchId: branchFilter },
        // Org-level events (no branch) stay visible for authorized users.
        { branchId: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Immutable record of system actions
          </p>
        </div>
        <DashboardBranchFilter
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          selectedBranchId={params.branchId ?? session.user.branchId ?? undefined}
          allEncoding="param"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Entity ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No audit logs yet.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(log.createdAt), "dd MMM yyyy HH:mm:ss")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.user
                      ? `${log.user.firstName} ${log.user.lastName}`
                      : "System"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell>{log.entityType}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.entityId?.slice(0, 8) ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

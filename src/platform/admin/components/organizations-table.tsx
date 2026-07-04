"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { updateOrganizationStatusAction } from "@/platform/admin/platform.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type OrgItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  email: string | null;
  createdAt: string;
  subscription: {
    status: string;
    plan: { name: string };
  } | null;
  _count: { users: number; branches: number; products: number };
};

export function OrganizationsTable({
  data,
}: {
  data: { items: OrgItem[]; total: number; page: number; limit: number };
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleStatusChange(orgId: string, status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED") {
    setLoadingId(orgId);
    const result = await updateOrganizationStatusAction({ organizationId: orgId, status });
    setLoadingId(null);
    if (result.success) {
      toast.success("Organization status updated");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              router.push(`/platform/organizations?search=${encodeURIComponent(search)}`);
            }
          }}
        />
        <Button
          variant="secondary"
          onClick={() =>
            router.push(`/platform/organizations?search=${encodeURIComponent(search)}`)
          }
        >
          Search
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((org) => (
              <TableRow key={org.id}>
                <TableCell>
                  <div>
                    <Link
                      href={`/platform/organizations/${org.id}`}
                      className="font-medium hover:underline"
                    >
                      {org.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{org.slug}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={org.status === "ACTIVE" ? "default" : "secondary"}>
                    {org.status}
                  </Badge>
                </TableCell>
                <TableCell>{org.subscription?.plan.name ?? "—"}</TableCell>
                <TableCell>{org._count.users}</TableCell>
                <TableCell>{org._count.branches}</TableCell>
                <TableCell>{org._count.products}</TableCell>
                <TableCell>
                  <Select
                    disabled={loadingId === org.id}
                    onValueChange={(value) =>
                      handleStatusChange(
                        org.id,
                        value as "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED",
                      )
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Set status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="TRIAL">Trial</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {data.items.length} of {data.total} organizations
      </p>
    </div>
  );
}

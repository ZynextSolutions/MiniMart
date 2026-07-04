"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setOrgModuleOverrideAction } from "@/platform/admin/platform.actions";
import type { OrgModuleRow } from "@/platform/modules/module-access.service";
import type { ModuleOverrideState } from "@/platform/modules/module-access.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OrgModulesManager({
  organizationId,
  planName,
  modules,
}: {
  organizationId: string;
  planName: string;
  modules: OrgModuleRow[];
}) {
  const router = useRouter();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function handleChange(moduleKey: string, state: ModuleOverrideState) {
    setSavingKey(moduleKey);
    const result = await setOrgModuleOverrideAction({
      organizationId,
      moduleKey,
      state,
    });
    setSavingKey(null);
    if (result.success) {
      toast.success("Module access updated");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Module Access</CardTitle>
        <p className="text-sm text-muted-foreground">
          Override plan defaults for this organization. Base plan: <strong>{planName}</strong>.
          Use &quot;Inherit&quot; to follow the plan, or force enable/disable per module.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Override</TableHead>
                <TableHead>Effective</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <div className="font-medium">{row.label}</div>
                    <div className="text-xs text-muted-foreground">{row.description}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.planEnabled ? "default" : "secondary"}>
                      {row.planEnabled ? "Included" : "Not included"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.override}
                      disabled={savingKey === row.key}
                      onValueChange={(value) =>
                        handleChange(row.key, value as ModuleOverrideState)
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">Inherit plan</SelectItem>
                        <SelectItem value="enabled">Force enable</SelectItem>
                        <SelectItem value="disabled">Force disable</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.effective ? "default" : "outline"}>
                      {row.effective ? "On" : "Off"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Per-org overrides are stored as feature flag overrides (`module.*` keys).
        </p>
      </CardContent>
    </Card>
  );
}

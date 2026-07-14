"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ALL_BRANCHES_PARAM } from "@/lib/auth/branch-access";

interface DashboardBranchFilterProps {
  branches: { id: string; name: string }[];
  /** Current URL branchId, or undefined for "all authorized" on dashboard. */
  selectedBranchId?: string;
  label?: string;
  /** When true, omit "All branches" and require a concrete branch. */
  requireSelection?: boolean;
  /**
   * How "All branches" is encoded in the URL.
   * - omit: delete branchId (dashboard: no param = all authorized)
   * - param: set branchId=all (lists/reports: no param = active branch)
   */
  allEncoding?: "omit" | "param";
}

export function DashboardBranchFilter({
  branches,
  selectedBranchId,
  label = "Branch",
  requireSelection = false,
  allEncoding = "omit",
}: DashboardBranchFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (branches.length <= 1) return null;

  function onBranchChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL_BRANCHES_PARAM && !requireSelection) {
      if (allEncoding === "param") params.set("branchId", ALL_BRANCHES_PARAM);
      else params.delete("branchId");
    } else {
      params.set("branchId", value);
    }
    const query = params.toString();
    router.push(query ? `?${query}` : "?");
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="dashboard-branch-filter">{label}</Label>
      <Select
        value={selectedBranchId ?? ALL_BRANCHES_PARAM}
        onValueChange={onBranchChange}
      >
        <SelectTrigger id="dashboard-branch-filter" className="w-56">
          <SelectValue placeholder="All branches" />
        </SelectTrigger>
        <SelectContent>
          {!requireSelection && (
            <SelectItem value={ALL_BRANCHES_PARAM}>All branches</SelectItem>
          )}
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

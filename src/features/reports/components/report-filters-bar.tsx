"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReportFiltersBarProps {
  mode: "asOf" | "range";
  defaultAsOf?: string;
  defaultFrom?: string;
  defaultTo?: string;
  defaultBranchId?: string;
  branches?: { id: string; name: string }[];
  exportReportType?: string;
  exportColumns?: { header: string; key: string }[];
  exportRows?: Record<string, string | number>[];
  exportTitle?: string;
}

export function ReportFiltersBar({
  mode,
  defaultAsOf,
  defaultFrom,
  defaultTo,
  defaultBranchId,
  branches = [],
  exportReportType,
  exportTitle,
}: ReportFiltersBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [branchId, setBranchId] = useState(defaultBranchId ?? "all");

  useEffect(() => {
    setBranchId(defaultBranchId ?? "all");
  }, [defaultBranchId]);

  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());

    if (mode === "asOf") {
      const asOf = form.get("asOf") as string;
      if (asOf) params.set("asOf", asOf);
    } else {
      const from = form.get("from") as string;
      const to = form.get("to") as string;
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }

    if (branchId && branchId !== "all") params.set("branchId", branchId);
    else params.delete("branchId");

    router.push(`?${params.toString()}`);
  }

  function buildExportUrl(format: "pdf" | "excel") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", format);
    if (exportReportType) params.set("type", exportReportType);
    if (exportTitle) params.set("title", exportTitle);
    return `/api/v1/reports/export?${params.toString()}`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;

  return (
    <form onSubmit={apply} className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
      {mode === "asOf" ? (
        <div className="space-y-1">
          <Label htmlFor="asOf">As of date</Label>
          <Input
            id="asOf"
            name="asOf"
            type="date"
            defaultValue={defaultAsOf ?? today}
            className="w-44"
          />
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={defaultFrom ?? monthStart}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={defaultTo ?? today}
              className="w-44"
            />
          </div>
        </>
      )}

      {branches.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="branchId">Branch</Label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="submit">Apply</Button>

      {exportReportType && (
        <div className="flex gap-2 ml-auto">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={buildExportUrl("pdf")} target="_blank" rel="noopener noreferrer">
              <Download className="mr-1 h-4 w-4" />
              PDF
            </a>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={buildExportUrl("excel")} target="_blank" rel="noopener noreferrer">
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Excel
            </a>
          </Button>
        </div>
      )}
    </form>
  );
}

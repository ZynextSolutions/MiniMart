"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReportDateFilterProps {
  mode: "asOf" | "range";
  defaultAsOf?: string;
  defaultFrom?: string;
  defaultTo?: string;
}

export function ReportDateFilter({
  mode,
  defaultAsOf,
  defaultFrom,
  defaultTo,
}: ReportDateFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

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

    router.push(`?${params.toString()}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;

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
              defaultValue={defaultFrom ?? yearStart}
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
      <Button type="submit">Apply</Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Plus, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  closeFiscalYearAction,
  closePeriodAction,
  createFiscalYearAction,
  listFiscalYearsAction,
} from "@/features/accounting/actions/accounting.actions";

interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  periods: Period[];
}

interface FiscalYearPageClientProps {
  fiscalYears: FiscalYear[];
}

export function FiscalYearPageClient({ fiscalYears: initial }: FiscalYearPageClientProps) {
  const [fiscalYears, setFiscalYears] = useState(initial);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const data = await listFiscalYearsAction();
    setFiscalYears(data);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await createFiscalYearAction({
      name: form.get("name") as string,
      startDate: form.get("startDate") as string,
      endDate: form.get("endDate") as string,
    });
    if (result.success) {
      toast.success("Fiscal year created");
      setOpen(false);
      await refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  async function handleClosePeriod(periodId: string) {
    const result = await closePeriodAction(periodId);
    if (result.success) {
      toast.success("Period closed");
      await refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleCloseYear(fiscalYearId: string) {
    const result = await closeFiscalYearAction(fiscalYearId);
    if (result.success) {
      toast.success("Fiscal year closed");
      await refresh();
    } else {
      toast.error(result.error);
    }
  }

  const year = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Fiscal Year
        </Button>
      </div>

      {fiscalYears.map((fy) => (
        <div key={fy.id} className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">{fy.name}</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(fy.startDate).toLocaleDateString()} —{" "}
                {new Date(fy.endDate).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={fy.isClosed ? "secondary" : "default"}>
                {fy.isClosed ? "Closed" : "Open"}
              </Badge>
              {!fy.isClosed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCloseYear(fy.id)}
                >
                  <Lock className="mr-1 h-3 w-3" />
                  Close Year
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {fy.periods.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <Badge variant={p.isClosed ? "secondary" : "outline"} className="mt-1">
                    {p.isClosed ? "Closed" : "Open"}
                  </Badge>
                </div>
                {!p.isClosed && !fy.isClosed && (
                  <Button variant="ghost" size="sm" onClick={() => handleClosePeriod(p.id)}>
                    <Lock className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Fiscal Year</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required defaultValue={`FY ${year + 1}`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={`${year + 1}-01-01`}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required
                  defaultValue={`${year + 1}-12-31`}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

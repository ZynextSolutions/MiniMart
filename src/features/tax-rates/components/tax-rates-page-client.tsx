"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { TaxRateFormDialog } from "./tax-rate-form-dialog";
import {
  deleteTaxRateAction,
  listTaxRatesAction,
  updateTaxModeAction,
} from "@/features/tax-rates/actions/tax-rate.actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaxMode } from "@/lib/utils/tax";

interface TaxRateRow {
  id: string;
  name: string;
  rate: string;
  isDefault: boolean;
  isActive: boolean;
  _count: { products: number };
}

interface TaxRatesPageClientProps {
  initialTaxRates: TaxRateRow[];
  initialTaxMode: TaxMode;
}

export function TaxRatesPageClient({ initialTaxRates, initialTaxMode }: TaxRatesPageClientProps) {
  const [taxRates, setTaxRates] = useState(initialTaxRates);
  const [taxMode, setTaxMode] = useState<TaxMode>(initialTaxMode);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTaxRate, setEditingTaxRate] = useState<TaxRateRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function refreshTaxRates() {
    const result = await listTaxRatesAction();
    setTaxRates(result as TaxRateRow[]);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteTaxRateAction(deleteId);
    if (result.success) {
      toast.success("Tax rate deleted");
      await refreshTaxRates();
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  }

  async function handleTaxModeChange(mode: TaxMode) {
    const previousMode = taxMode;
    setTaxMode(mode);
    const result = await updateTaxModeAction(mode);
    if (result.success) {
      toast.success(`Tax mode updated to ${mode.toLowerCase()}`);
      return;
    }
    setTaxMode(previousMode);
    toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax Rates</h1>
          <p className="text-muted-foreground">{taxRates.length} tax rates total</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={taxMode} onValueChange={(value) => handleTaxModeChange(value as TaxMode)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tax mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXCLUSIVE">VAT/GST Exclusive (Default)</SelectItem>
              <SelectItem value="INCLUSIVE">VAT/GST Inclusive</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditingTaxRate(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tax Rate
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {taxRates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No tax rates found.
                </TableCell>
              </TableRow>
            ) : (
              taxRates.map((taxRate) => (
                <TableRow key={taxRate.id}>
                  <TableCell className="font-medium">{taxRate.name}</TableCell>
                  <TableCell>
                    {(parseFloat(taxRate.rate) * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell>{taxRate._count.products}</TableCell>
                  <TableCell>
                    {taxRate.isDefault ? (
                      <Badge variant="default">Default</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={taxRate.isActive ? "default" : "secondary"}>
                      {taxRate.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingTaxRate(taxRate);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(taxRate.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TaxRateFormDialog
        key={editingTaxRate?.id ?? "new-tax-rate"}
        open={formOpen}
        onOpenChange={setFormOpen}
        taxRate={editingTaxRate}
        onSuccess={refreshTaxRates}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete tax rate"
        description="This tax rate will be removed. It cannot be deleted if used by products."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

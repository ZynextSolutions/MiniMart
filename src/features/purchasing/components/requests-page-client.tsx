"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PurchaseVariantSearch,
  type PurchaseVariantOption,
} from "./purchase-variant-search";
import {
  createPurchaseRequestAction,
  submitPurchaseRequestAction,
  approvePurchaseRequestAction,
  createPOFromRequestAction,
} from "@/features/purchasing/actions/purchasing.actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RequestRow {
  id: string;
  requestNumber: string;
  requestDate: Date;
  status: string;
  _count: { lines: number };
}

interface RequestsPageClientProps {
  requests: RequestRow[];
  suppliers: { id: string; name: string; code: string }[];
}

interface LineItem {
  variantId: string;
  label: string;
  quantity: number;
  estimatedCost: number;
}

export function RequestsPageClient({ requests, suppliers }: RequestsPageClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10));
  const [poDialog, setPoDialog] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  function addVariant(v: PurchaseVariantOption) {
    if (lines.some((l) => l.variantId === v.id)) {
      toast.error("Already added");
      return;
    }
    setLines([
      ...lines,
      {
        variantId: v.id,
        label: `${v.product.name} (${v.sku})`,
        quantity: 1,
        estimatedCost: Number(v.costPrice),
      },
    ]);
  }

  async function handleCreate() {
    if (lines.length === 0) return;
    setSubmitting(true);
    const result = await createPurchaseRequestAction({
      requestDate,
      lines: lines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        estimatedCost: l.estimatedCost,
      })),
    });
    setSubmitting(false);
    if (result.success) {
      toast.success("Request created");
      setOpen(false);
      setLines([]);
      router.refresh();
    } else toast.error(result.error);
  }

  async function handleAction(action: "submit" | "approve", id: string) {
    const result =
      action === "submit"
        ? await submitPurchaseRequestAction(id)
        : await approvePurchaseRequestAction(id);
    if (result.success) {
      toast.success(action === "submit" ? "Submitted" : "Approved");
      router.refresh();
    } else toast.error(result.error);
  }

  async function handleCreatePO() {
    if (!poDialog || !supplierId) return;
    const result = await createPOFromRequestAction(poDialog, supplierId);
    if (result.success) {
      toast.success(`PO ${result.po?.orderNumber} created`);
      setPoDialog(null);
      router.refresh();
    } else toast.error(result.error);
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No purchase requests
                </TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.requestNumber}</TableCell>
                  <TableCell>{new Date(r.requestDate).toLocaleDateString()}</TableCell>
                  <TableCell>{r._count.lines}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {r.status === "DRAFT" && (
                      <Button size="sm" variant="secondary" onClick={() => handleAction("submit", r.id)}>
                        Submit
                      </Button>
                    )}
                    {r.status === "PENDING" && (
                      <Button size="sm" onClick={() => handleAction("approve", r.id)}>
                        Approve
                      </Button>
                    )}
                    {r.status === "APPROVED" && (
                      <Button size="sm" variant="outline" onClick={() => setPoDialog(r.id)}>
                        Create PO
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Purchase Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
            </div>
            <PurchaseVariantSearch onSelect={addVariant} />
            {lines.map((l, i) => (
              <div key={l.variantId} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{l.label}</span>
                <Input
                  type="number"
                  className="w-20"
                  value={l.quantity}
                  onChange={(e) => {
                    const qty = parseFloat(e.target.value) || 0;
                    setLines(lines.map((x, idx) => (idx === i ? { ...x, quantity: qty } : x)));
                  }}
                />
                <Input
                  type="number"
                  className="w-24"
                  value={l.estimatedCost}
                  onChange={(e) => {
                    const cost = parseFloat(e.target.value) || 0;
                    setLines(lines.map((x, idx) => (idx === i ? { ...x, estimatedCost: cost } : x)));
                  }}
                />
                <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={submitting || lines.length === 0}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!poDialog} onOpenChange={() => setPoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create PO from Request</DialogTitle>
          </DialogHeader>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={handleCreatePO}>Create PO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

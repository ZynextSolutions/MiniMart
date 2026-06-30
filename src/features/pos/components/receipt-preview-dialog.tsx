"use client";

import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getReceiptHtmlAction } from "@/features/pos/actions/pos.actions";
import {
  downloadEscPos,
  imageUrlToEscPosBitmap,
  sendEscPosToSerial,
} from "@/lib/services/esc-pos-builder";

interface ReceiptPreviewDialogProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logoUrl?: string | null;
}

export function ReceiptPreviewDialog({
  saleId,
  open,
  onOpenChange,
  logoUrl,
}: ReceiptPreviewDialogProps) {
  const [html, setHtml] = useState("");
  const [width, setWidth] = useState<"58" | "80">("80");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && saleId) {
      setLoading(true);
      getReceiptHtmlAction(saleId, width).then((h) => {
        setHtml(h);
        setLoading(false);
      });
    }
  }, [open, saleId, width]);

  function handlePrint() {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  }

  async function handleEscPosDownload(kickDrawer = false) {
    if (!saleId) return;
    const params = new URLSearchParams({ saleId, width });
    if (kickDrawer) params.set("drawer", "1");
    window.open(`/api/v1/receipt/escpos?${params.toString()}`, "_blank");
  }

  async function handleSerialPrint() {
    if (!saleId) return;
    try {
      const params = new URLSearchParams({ saleId, width });
      const res = await fetch(`/api/v1/receipt/escpos?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to generate ESC/POS");
      let data = new Uint8Array(await res.arrayBuffer());

      if (logoUrl) {
        const bitmap = await imageUrlToEscPosBitmap(logoUrl, width === "58" ? 256 : 384);
        if (bitmap) {
          // Logo prepended client-side would require re-building; download fallback
          toast.info("Logo embedded in browser print; ESC/POS download may omit logo unless configured.");
        }
      }

      const sent = await sendEscPosToSerial(data);
      if (sent) {
        toast.success("Sent to thermal printer");
      } else {
        downloadEscPos(data, `receipt-${saleId}.bin`);
        toast.info("Serial unavailable — downloaded ESC/POS file instead");
      }
    } catch {
      toast.error("Failed to send to printer");
    }
  }

  async function handleCashDrawer() {
    if (!saleId) return;
    try {
      const params = new URLSearchParams({ saleId, width, drawer: "1" });
      const res = await fetch(`/api/v1/receipt/escpos?${params.toString()}`);
      const data = new Uint8Array(await res.arrayBuffer());
      const sent = await sendEscPosToSerial(data);
      if (!sent) {
        downloadEscPos(data, "cash-drawer-kick.bin");
        toast.info("Download ESC/POS file and send to printer to open drawer");
      } else {
        toast.success("Cash drawer command sent");
      }
    } catch {
      toast.error("Failed to kick cash drawer");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Receipt Preview</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <Label>Paper width</Label>
          <Select value={width} onValueChange={(v) => setWidth(v as "58" | "80")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="58">58mm</SelectItem>
              <SelectItem value="80">80mm</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-muted-foreground py-8 text-center">Loading...</p>
        ) : html ? (
          <iframe
            srcDoc={html}
            className="h-[400px] w-full rounded border"
            title="Receipt preview"
          />
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={handleCashDrawer} disabled={!saleId}>
            Open Drawer
          </Button>
          <Button variant="outline" onClick={() => handleEscPosDownload()} disabled={!html}>
            <Download className="mr-1 h-4 w-4" />
            ESC/POS
          </Button>
          <Button variant="outline" onClick={handleSerialPrint} disabled={!html}>
            Serial Print
          </Button>
          <Button onClick={handlePrint} disabled={!html}>
            <Printer className="mr-1 h-4 w-4" />
            Browser Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

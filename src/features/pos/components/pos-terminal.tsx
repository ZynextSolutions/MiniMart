"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Camera, ClipboardList, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "./product-grid";
import { CartPanel } from "./cart-panel";
import { PaymentDialog } from "./payment-dialog";
import { HoldSalesDrawer } from "./hold-sales-drawer";
import { BarcodeScannerModal } from "./barcode-scanner-modal";
import { CustomerSelectDialog } from "./customer-select-dialog";
import { DiscountDialog } from "./discount-dialog";
import { ReceiptPreviewDialog } from "./receipt-preview-dialog";
import { OpenRegisterDialog } from "./open-register-dialog";
import { ReturnDialog } from "./return-dialog";
import { useBarcodeScanner } from "@/features/pos/hooks/use-barcode-scanner";
import { usePosCartStore } from "@/features/pos/stores/pos-cart-store";
import { holdSaleAction, lookupBarcodeAction } from "@/features/pos/actions/pos.actions";
import type { TaxMode } from "@/lib/utils/tax";

interface PosTerminalProps {
  warehouseId: string;
  registers: { id: string; code: string; name: string; openSessionId?: string }[];
  initialSessionId?: string;
  initialRegisterId?: string;
  taxMode: TaxMode;
}

export function PosTerminal({
  warehouseId,
  registers,
  initialSessionId,
  initialRegisterId,
  taxMode,
}: PosTerminalProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [sessionId, setSessionId] = useState(initialSessionId ?? "");
  const [registerId, setRegisterId] = useState(initialRegisterId ?? "");
  const [showOpenRegister, setShowOpenRegister] = useState(!initialSessionId);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  const addItem = usePosCartStore((s) => s.addItem);
  const clear = usePosCartStore((s) => s.clear);
  const getSnapshot = usePosCartStore((s) => s.getSnapshot);
  const items = usePosCartStore((s) => s.items);
  const lastSaleId = usePosCartStore((s) => s.lastSaleId);
  const setLastSaleId = usePosCartStore((s) => s.setLastSaleId);
  const setTaxMode = usePosCartStore((s) => s.setTaxMode);
  const selectedLineId = usePosCartStore((s) => s.selectedLineId);
  const updateQty = usePosCartStore((s) => s.updateQty);
  const removeItem = usePosCartStore((s) => s.removeItem);

  const handleBarcode = useCallback(
    async (code: string) => {
      const product = await lookupBarcodeAction(code);
      if (product) {
        addItem(product);
        toast.success(`Added ${product.name}`);
      } else {
        toast.error(`Product not found: ${code}`);
      }
    },
    [addItem],
  );

  useBarcodeScanner({ onScan: handleBarcode, enabled: !!sessionId });

  useEffect(() => {
    setTaxMode(taxMode);
  }, [setTaxMode, taxMode]);

  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId);
      setRegisterId(initialRegisterId ?? "");
      setShowOpenRegister(false);
    }
  }, [initialSessionId, initialRegisterId]);

  const handleHold = useCallback(async () => {
    if (items.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    const result = await holdSaleAction(getSnapshot());
    if (result.success) {
      toast.success(`Sale held: ${result.hold?.holdNumber}`);
      clear();
    } else {
      toast.error(result.error);
    }
  }, [getSnapshot, items.length, clear]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!sessionId) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        if (e.key !== "F4" && e.key !== "F5") return;
      }

      switch (e.key) {
        case "F1":
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case "F2":
          e.preventDefault();
          handleHold();
          break;
        case "F3":
          e.preventDefault();
          setHoldOpen(true);
          break;
        case "F4":
          e.preventDefault();
          setPaymentOpen(true);
          break;
        case "F8":
          e.preventDefault();
          setDiscountOpen(true);
          break;
        case "F9":
          e.preventDefault();
          setCustomerOpen(true);
          break;
        case "Delete":
          if (selectedLineId) removeItem(selectedLineId);
          break;
        case "+":
        case "=":
          if (selectedLineId) {
            const item = usePosCartStore.getState().items.find((i) => i.lineId === selectedLineId);
            if (item) updateQty(selectedLineId, item.quantity + 1);
          }
          break;
        case "-":
          if (selectedLineId) {
            const item = usePosCartStore.getState().items.find((i) => i.lineId === selectedLineId);
            if (item) updateQty(selectedLineId, item.quantity - 1);
          }
          break;
        default:
          if (e.ctrlKey && e.key === "n") {
            e.preventDefault();
            clear();
          }
          if (e.ctrlKey && e.key === "p" && lastSaleId) {
            e.preventDefault();
            setReceiptSaleId(lastSaleId);
            setReceiptOpen(true);
          }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessionId, selectedLineId, lastSaleId, removeItem, updateQty, clear, handleHold]);

  function handleSessionOpened(sid: string, rid: string) {
    setSessionId(sid);
    setRegisterId(rid);
    setShowOpenRegister(false);
  }

  return (
    <>
      <OpenRegisterDialog
        open={showOpenRegister}
        onOpenChange={setShowOpenRegister}
        registers={registers}
        onSessionOpened={handleSessionOpened}
      />

      {sessionId && (
        <div className="flex h-[calc(100vh-8rem)] flex-col gap-3 lg:flex-row">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setScannerOpen(true)}>
                <Camera className="mr-1 h-4 w-4" />
                Camera
              </Button>
              <Button variant="outline" size="sm" onClick={() => searchRef.current?.focus()}>
                <ScanBarcode className="mr-1 h-4 w-4" />
                Search
              </Button>
              <Button variant="outline" size="sm" onClick={() => setHoldOpen(true)}>
                <ClipboardList className="mr-1 h-4 w-4" />
                Held sales
              </Button>
              <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)}>
                Return
              </Button>
            </div>
            <div className="flex-1 overflow-hidden rounded-lg border bg-background p-3">
              <ProductGrid
                onAddProduct={(p) => {
                  addItem(p);
                  toast.success(`Added ${p.name}`);
                }}
                searchInputRef={searchRef}
              />
            </div>
          </div>

          <div className="w-full lg:w-[380px] shrink-0">
            <CartPanel
              onPay={() => setPaymentOpen(true)}
              onHold={handleHold}
              onSelectCustomer={() => setCustomerOpen(true)}
              onDiscount={() => setDiscountOpen(true)}
              onClear={clear}
            />
          </div>
        </div>
      )}

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        warehouseId={warehouseId}
        sessionId={sessionId}
        cashRegisterId={registerId}
        onComplete={(saleId) => {
          setLastSaleId(saleId);
          setReceiptSaleId(saleId);
          setReceiptOpen(true);
        }}
      />

      <HoldSalesDrawer open={holdOpen} onOpenChange={setHoldOpen} />
      <BarcodeScannerModal open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleBarcode} />
      <CustomerSelectDialog open={customerOpen} onOpenChange={setCustomerOpen} />
      <DiscountDialog open={discountOpen} onOpenChange={setDiscountOpen} />
      <ReceiptPreviewDialog saleId={receiptSaleId} open={receiptOpen} onOpenChange={setReceiptOpen} />
      <ReturnDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        warehouseId={warehouseId}
        sessionId={sessionId}
        cashRegisterId={registerId}
        onComplete={(saleId) => {
          setReceiptSaleId(saleId);
          setReceiptOpen(true);
        }}
      />
    </>
  );
}

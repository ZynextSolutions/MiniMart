"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { openRegisterSessionAction } from "@/features/pos/actions/pos.actions";

interface RegisterOption {
  id: string;
  code: string;
  name: string;
  openSessionId?: string;
}

interface OpenRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registers: RegisterOption[];
  onSessionOpened: (sessionId: string, registerId: string) => void;
}

export function OpenRegisterDialog({
  open,
  onOpenChange,
  registers,
  onSessionOpened,
}: OpenRegisterDialogProps) {
  const [registerId, setRegisterId] = useState(registers[0]?.id ?? "");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!registerId && registers[0]?.id) {
      setRegisterId(registers[0].id);
    }
  }, [registerId, registers]);

  const selectedRegister = registers.find((r) => r.id === registerId);
  const existingSessionId = selectedRegister?.openSessionId;

  function resumeSession(sessionId: string, rid: string) {
    onSessionOpened(sessionId, rid);
    onOpenChange(false);
  }

  async function handleOpen() {
    if (!registerId) return;

    if (existingSessionId) {
      resumeSession(existingSessionId, registerId);
      return;
    }

    setSubmitting(true);
    const result = await openRegisterSessionAction(registerId, parseFloat(openingBalance) || 0);
    setSubmitting(false);

    if (result.success && result.sessionId) {
      toast.success("Register opened");
      resumeSession(result.sessionId, registerId);
      return;
    }

    if (result.error?.toLowerCase().includes("open session")) {
      const register = registers.find((r) => r.id === registerId);
      if (register?.openSessionId) {
        toast.info("Resuming existing session");
        resumeSession(register.openSessionId, registerId);
        return;
      }
    }

    toast.error(result.error ?? "Failed to open register");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open Cash Register</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Register</Label>
            <Select value={registerId} onValueChange={setRegisterId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {registers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.code} — {r.name}
                    {r.openSessionId ? " (session open)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {existingSessionId ? (
            <p className="text-sm text-muted-foreground">
              This register already has an open session. Continue to use it, or close it from
              Cash Register before opening a new one.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Opening Balance</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleOpen} disabled={submitting || !registerId}>
            {submitting
              ? "Opening..."
              : existingSessionId
                ? "Continue Session"
                : "Open Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

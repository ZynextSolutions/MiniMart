import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CashRegisterService } from "@/lib/services/cash-register-service";
import { WarehouseService } from "@/features/warehouses/services/warehouse.service";
import { PosTerminal } from "@/features/pos/components/pos-terminal";
import { TaxSettingsService } from "@/lib/services/tax-settings-service";

export default async function PosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.POS.ACCESS);

  if (!session.user.branchId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Select a branch to use POS</p>
      </div>
    );
  }

  const [registers, warehouses, taxMode] = await Promise.all([
    CashRegisterService.listRegisters(session.user.branchId),
    WarehouseService.list(session.user.organizationId, session.user.branchId),
    TaxSettingsService.getTaxMode(session.user.organizationId),
  ]);

  const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? warehouses[0];
  const registerWithOpenSession = registers.find((r) => r.sessions.length > 0);
  const openSession = registerWithOpenSession?.sessions[0];
  const serializedRegisters = registers.map((register) => ({
    id: register.id,
    code: register.code,
    name: register.name,
    openSessionId: register.sessions[0]?.id,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Point of Sale</h1>
          <p className="text-muted-foreground">
            {openSession
              ? `Session open · ${registerWithOpenSession?.name}`
              : "Open a cash register to start"}
          </p>
        </div>
      </div>

      {defaultWarehouse ? (
        <PosTerminal
          warehouseId={defaultWarehouse.id}
          registers={serializedRegisters}
          initialSessionId={openSession?.id}
          initialRegisterId={registerWithOpenSession?.id ?? serializedRegisters[0]?.id}
          taxMode={taxMode}
        />
      ) : (
        <p className="text-muted-foreground">No warehouse configured for this branch.</p>
      )}
    </div>
  );
}

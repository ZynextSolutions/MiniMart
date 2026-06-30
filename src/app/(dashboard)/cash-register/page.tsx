import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CashRegisterService } from "@/lib/services/cash-register-service";
import { CashRegisterPageClient } from "@/features/pos/components/cash-register-page-client";

export default async function CashRegisterPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.CASH_REGISTER.VIEW);

  let openSession = null;
  if (session.user.branchId) {
    const registers = await CashRegisterService.listRegisters(session.user.branchId);
    const registerWithSession = registers.find((r) => r.sessions.length > 0);
    if (registerWithSession?.sessions[0]) {
      const sessionRow = registerWithSession.sessions[0];
      openSession = {
        id: sessionRow.id,
        status: sessionRow.status,
        openingBalance: sessionRow.openingBalance.toString(),
        openedAt: sessionRow.openedAt.toISOString(),
        cashRegister: {
          name: registerWithSession.name,
          code: registerWithSession.code,
        },
      };
    }
  }

  return <CashRegisterPageClient session={openSession} />;
}

"use client";

import { useLayoutEffect } from "react";
import { useSession } from "next-auth/react";
import { setSystemCurrency } from "@/lib/utils/format";

/** Keeps client-side formatMoney in sync with the signed-in organization's currency. */
export function SystemCurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const currency = session?.user?.currency;

  useLayoutEffect(() => {
    if (currency) {
      setSystemCurrency(currency);
    }
  }, [currency]);

  return children;
}

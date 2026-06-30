"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { SystemCurrencyProvider } from "./system-currency-provider";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <SystemCurrencyProvider>{children}</SystemCurrencyProvider>
    </NextAuthSessionProvider>
  );
}

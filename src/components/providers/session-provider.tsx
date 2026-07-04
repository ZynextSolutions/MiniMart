"use client";

import type { Session } from "next-auth";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { SystemCurrencyProvider } from "./system-currency-provider";

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <NextAuthSessionProvider session={session}>
      <SystemCurrencyProvider>{children}</SystemCurrencyProvider>
    </NextAuthSessionProvider>
  );
}

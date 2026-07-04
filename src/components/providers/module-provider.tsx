"use client";

import { createContext, useContext, useMemo } from "react";
import type { PlatformModuleKey } from "@/platform/modules/platform-modules";

type ModuleContextValue = {
  modules: Record<PlatformModuleKey, boolean>;
  isModuleEnabled: (key: PlatformModuleKey) => boolean;
};

const ModuleContext = createContext<ModuleContextValue | null>(null);

export function ModuleProvider({
  modules,
  children,
}: {
  modules: Record<PlatformModuleKey, boolean>;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      modules,
      isModuleEnabled: (key: PlatformModuleKey) => modules[key] ?? false,
    }),
    [modules],
  );

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
}

export function useModules() {
  const ctx = useContext(ModuleContext);
  if (!ctx) {
    return {
      modules: {} as Record<PlatformModuleKey, boolean>,
      isModuleEnabled: () => true,
    };
  }
  return ctx;
}

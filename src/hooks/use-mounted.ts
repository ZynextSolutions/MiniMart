"use client";

import { useEffect, useState } from "react";

/** True only after the component has mounted on the client (avoids SSR/client Radix useId drift). */
export function useMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

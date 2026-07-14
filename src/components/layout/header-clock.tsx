"use client";

import { useEffect, useState } from "react";
import { useMounted } from "@/hooks/use-mounted";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

export function HeaderClock() {
  const mounted = useMounted();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!mounted) {
    return (
      <div
        className="hidden h-8 w-36 sm:block"
        aria-hidden
      />
    );
  }

  return (
    <time
      dateTime={now.toISOString()}
      className="hidden tabular-nums text-right text-xs leading-tight text-muted-foreground sm:block"
      title={now.toLocaleString()}
    >
      <span className="block">{dateFormatter.format(now)}</span>
      <span className="block font-medium text-foreground">
        {timeFormatter.format(now)}
      </span>
    </time>
  );
}

export const DEFAULT_ORG_TIMEZONE = "Asia/Yangon";

export function resolveOrgTimezone(timezone?: string | null): string {
  if (!timezone?.trim()) return DEFAULT_ORG_TIMEZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_ORG_TIMEZONE;
  }
}

export function orgLocalDateKey(
  date: Date,
  timezone: string = DEFAULT_ORG_TIMEZONE,
): string {
  const tz = resolveOrgTimezone(timezone);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dateKeyAddDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );

  return asUtc - date.getTime();
}

function zonedTimeToUtc(dateKey: string, time: string, timezone: string): Date {
  const tz = resolveOrgTimezone(timezone);
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm, ssPart = "0"] = time.split(":");
  const ss = parseFloat(ssPart);

  const desiredAsUtc = Date.UTC(
    y,
    m - 1,
    d,
    Number(hh),
    Number(mm),
    Math.floor(ss),
    Math.round((ss % 1) * 1000),
  );

  let result = desiredAsUtc;
  for (let i = 0; i < 5; i++) {
    result = desiredAsUtc - getTimezoneOffsetMs(new Date(result), tz);
  }

  return new Date(result);
}

export function startOfOrgDay(
  date: Date,
  timezone: string = DEFAULT_ORG_TIMEZONE,
): Date {
  const tz = resolveOrgTimezone(timezone);
  return zonedTimeToUtc(orgLocalDateKey(date, tz), "00:00:00", tz);
}

export function startOfOrgDayForDateKey(
  dateKey: string,
  timezone: string = DEFAULT_ORG_TIMEZONE,
): Date {
  const tz = resolveOrgTimezone(timezone);
  return zonedTimeToUtc(dateKey, "00:00:00", tz);
}

export function endOfOrgDay(date: Date, timezone: string = DEFAULT_ORG_TIMEZONE): Date {
  const tz = resolveOrgTimezone(timezone);
  const nextKey = dateKeyAddDays(orgLocalDateKey(date, tz), 1);
  return new Date(zonedTimeToUtc(nextKey, "00:00:00", tz).getTime() - 1);
}

export function formatDateKeyLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatOrgDateTime(
  date: Date | string,
  timezone: string = DEFAULT_ORG_TIMEZONE,
): string {
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "";

  const tz = resolveOrgTimezone(timezone);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };

  return new Intl.DateTimeFormat("en-US", options).format(value);
}

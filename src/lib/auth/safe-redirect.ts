/**
 * Normalize post-login redirect URLs to same-origin relative paths.
 */
export function normalizeOrgCallbackUrl(url: string, origin: string): string {
  if (!url) return "/";
  if (url.startsWith("//")) return "/";
  if (url.startsWith("/") && !url.startsWith("//")) return url;

  try {
    const parsed = new URL(url, origin);
    if (parsed.origin === origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // fall through
  }

  return "/";
}

export function normalizePlatformCallbackUrl(url: string, origin: string): string {
  const normalized = normalizeOrgCallbackUrl(url, origin);
  if (normalized === "/") return "/platform";
  if (normalized.startsWith("/platform")) return normalized;
  return "/platform";
}

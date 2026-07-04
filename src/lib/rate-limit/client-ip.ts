export function getClientIp(request: Request | { headers: Headers }): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  if (process.env.TRUST_PROXY === "true") {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }
  }

  return "unknown";
}

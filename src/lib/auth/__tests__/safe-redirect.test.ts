import { describe, expect, it } from "vitest";
import { normalizeOrgCallbackUrl, normalizePlatformCallbackUrl } from "@/lib/auth/safe-redirect";

describe("safe redirect normalization", () => {
  const origin = "https://app.example.com";

  it("rejects protocol-relative URLs for org login", () => {
    expect(normalizeOrgCallbackUrl("//evil.com", origin)).toBe("/");
  });

  it("allows same-origin absolute URLs for org login", () => {
    expect(normalizeOrgCallbackUrl("https://app.example.com/reports", origin)).toBe("/reports");
  });

  it("rejects external URLs for org login", () => {
    expect(normalizeOrgCallbackUrl("https://evil.com/phish", origin)).toBe("/");
  });

  it("restricts platform login to /platform paths", () => {
    expect(normalizePlatformCallbackUrl("/settings", origin)).toBe("/platform");
    expect(normalizePlatformCallbackUrl("/platform/organizations", origin)).toBe(
      "/platform/organizations",
    );
    expect(normalizePlatformCallbackUrl("https://evil.com", origin)).toBe("/platform");
  });
});

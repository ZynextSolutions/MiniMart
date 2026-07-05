import { describe, expect, it } from "vitest";
import { DEFAULT_ORG_TIMEZONE, formatOrgDateTime } from "@/lib/utils/datetime";

describe("formatOrgDateTime", () => {
  it("formats using org timezone with AM/PM", () => {
    const utc = new Date("2026-07-05T12:00:00.000Z");
    expect(formatOrgDateTime(utc, "Asia/Yangon")).toBe("07/05/2026, 06:30:00 PM");
  });

  it("defaults to Asia/Yangon", () => {
    const utc = new Date("2026-07-05T12:00:00.000Z");
    expect(formatOrgDateTime(utc)).toBe(
      formatOrgDateTime(utc, DEFAULT_ORG_TIMEZONE),
    );
  });

  it("accepts ISO strings", () => {
    expect(formatOrgDateTime("2026-07-05T12:00:00.000Z", "UTC")).toBe(
      "07/05/2026, 12:00:00 PM",
    );
  });

  it("falls back for invalid timezone", () => {
    const utc = new Date("2026-07-05T12:00:00.000Z");
    expect(formatOrgDateTime(utc, "Not/A_Timezone")).toBe("07/05/2026, 06:30:00 PM");
  });

  it("returns empty string for invalid dates", () => {
    expect(formatOrgDateTime("not-a-date")).toBe("");
  });
});

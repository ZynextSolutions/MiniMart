import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCOUNT_MAPPING,
  parseAccountMapping,
} from "@/platform/onboarding/default-account-mapping";

describe("parseAccountMapping", () => {
  it("parses a valid mapping object", () => {
    expect(parseAccountMapping(DEFAULT_ACCOUNT_MAPPING)).toEqual(DEFAULT_ACCOUNT_MAPPING);
  });

  it("rejects missing keys", () => {
    expect(parseAccountMapping({ cash: "1100" })).toBeNull();
  });

  it("rejects empty codes", () => {
    expect(
      parseAccountMapping({
        ...DEFAULT_ACCOUNT_MAPPING,
        cash: "  ",
      }),
    ).toBeNull();
  });

  it("rejects non-object values", () => {
    expect(parseAccountMapping(null)).toBeNull();
    expect(parseAccountMapping("1100")).toBeNull();
  });

  it("trims account codes", () => {
    expect(
      parseAccountMapping({
        ...DEFAULT_ACCOUNT_MAPPING,
        cash: " 1100 ",
      })?.cash,
    ).toBe("1100");
  });
});

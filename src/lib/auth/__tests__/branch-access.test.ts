import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/errors/app-error";
import {
  resolveAuthorizedBranchFilter,
} from "@/lib/auth/branch-access";

describe("resolveAuthorizedBranchFilter", () => {
  const branchIds = ["branch-a", "branch-b"];

  it("returns requested branch when user is assigned", () => {
    expect(resolveAuthorizedBranchFilter(branchIds, "branch-a")).toBe("branch-a");
  });

  it("throws when requested branch is not assigned", () => {
    expect(() => resolveAuthorizedBranchFilter(branchIds, "branch-x")).toThrow(ForbiddenError);
  });

  it("returns in-filter for all assigned branches when none requested", () => {
    expect(resolveAuthorizedBranchFilter(branchIds)).toEqual({ in: branchIds });
  });

  it("throws when user has no branch assignments", () => {
    expect(() => resolveAuthorizedBranchFilter([])).toThrow(ForbiddenError);
  });
});

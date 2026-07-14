import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/errors/app-error";
import {
  ALL_BRANCHES_PARAM,
  requireAuthorizedBranchId,
  resolveAuthorizedBranchFilter,
  resolveSessionBranchFilter,
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

describe("requireAuthorizedBranchId", () => {
  const branchIds = ["branch-a", "branch-b"];

  it("returns the branch when authorized", () => {
    expect(requireAuthorizedBranchId(branchIds, "branch-b")).toBe("branch-b");
  });

  it("throws when branch is not authorized", () => {
    expect(() => requireAuthorizedBranchId(branchIds, "branch-x")).toThrow(
      ForbiddenError,
    );
  });
});

describe("resolveSessionBranchFilter", () => {
  const session = {
    branchIds: ["branch-a", "branch-b"],
    branchId: "branch-a",
  };

  it("defaults to the active branch when no request is provided", () => {
    expect(resolveSessionBranchFilter(session)).toBe("branch-a");
  });

  it("returns all authorized branches when all is requested", () => {
    expect(resolveSessionBranchFilter(session, ALL_BRANCHES_PARAM)).toEqual({
      in: ["branch-a", "branch-b"],
    });
  });

  it("returns a specific authorized branch", () => {
    expect(resolveSessionBranchFilter(session, "branch-b")).toBe("branch-b");
  });
});

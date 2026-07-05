import { describe, expect, it } from "vitest";
import { DashboardService } from "@/features/dashboard/services/dashboard.service";

describe("dashboard sales trend", () => {
  it("includes seeded sales in trend rows", async () => {
    const filters = {
      organizationId: "00000000-0000-0000-0000-000000000001",
      timezone: "Asia/Yangon",
    };
    const trend = await DashboardService.getSalesTrend(filters, 30);
    const withSales = trend.filter((r) => r.sales > 0);
    console.log("trend points with sales", withSales.length, withSales.slice(0, 3));
    expect(withSales.length).toBeGreaterThan(0);
  });
});

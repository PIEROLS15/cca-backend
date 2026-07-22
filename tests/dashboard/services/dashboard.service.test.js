const dashboardService = require("../../../src/api/dashboard/services/dashboard.service");

describe("dashboard service", () => {
  it("returns summary data", async () => {
    await expect(dashboardService.getSummary()).resolves.toMatchObject({
      certificates: expect.any(Number),
      clients: expect.any(Number),
      sectors: expect.any(Number),
    });
  });

  it("returns status breakdown", async () => {
    await expect(dashboardService.getStatusBreakdown()).resolves.toEqual(expect.any(Array));
  });

  it("returns monthly activity", async () => {
    await expect(dashboardService.getMonthlyActivity()).resolves.toHaveLength(12);
  });

  it("returns recent activity", async () => {
    await expect(dashboardService.getRecentActivity()).resolves.toEqual(expect.any(Array));
  });
});

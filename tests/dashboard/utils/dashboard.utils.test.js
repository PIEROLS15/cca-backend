const { toSummary, toStatusBreakdown, toMonthlyActivity } = require("../../../src/api/dashboard/utils/dashboard.utils");

describe("dashboard utils", () => {
  it("builds a summary", () => {
    expect(toSummary({ certificates: 1, clients: 2, comuneros: 3, terceros: 4, terrainTypes: 5, sectors: 6 })).toEqual({
      certificates: 1,
      clients: 2,
      comuneros: 3,
      terceros: 4,
      terrainTypes: 5,
      sectors: 6,
    });
  });

  it("builds a status breakdown", () => {
    expect(toStatusBreakdown([{ status: "Recepcionado", _count: 2 }])).toHaveLength(5);
  });

  it("passes through monthly activity", () => {
    const data = [{ mes: "Ene" }];
    expect(toMonthlyActivity(data)).toBe(data);
  });
});

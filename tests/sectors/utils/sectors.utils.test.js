const { normalizeName } = require("../../../src/api/sectors/utils/sectors.utils");

describe("sectors utils", () => {
  it("normalizes names", () => {
    expect(normalizeName("  Sector   Norte  ")).toBe("Sector Norte");
  });
});

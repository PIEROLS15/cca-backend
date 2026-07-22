const {
  normalizeName,
  formatTerrainTypeConfig,
  formatTerrainTypeResponse,
} = require("../../../src/api/terrain-types/utils/terrain-types.utils");

describe("terrain-types utils", () => {
  it("normalizes names", () => {
    expect(normalizeName("  Tipo   de   Terreno  ")).toBe("Tipo de Terreno");
  });

  it("formats terrain configs", () => {
    expect(formatTerrainTypeConfig({ id: 1, key: "x", label: "X", formMode: "auto" })).toMatchObject({
      id: 1,
      key: "x",
      label: "X",
      formMode: "auto",
    });
  });

  it("formats terrain types", () => {
    expect(formatTerrainTypeResponse({ id: 1, name: "Lote", terrainTypeConfigId: 2, config: { id: 3, key: "x" } })).toMatchObject({
      id: 1,
      name: "Lote",
      terrainTypeConfigId: 2,
      config: { id: 3, key: "x" },
    });
  });
});

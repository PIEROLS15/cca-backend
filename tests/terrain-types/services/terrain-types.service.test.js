const prisma = require("../../../src/config/prisma");
const terrainTypesService = require("../../../src/api/terrain-types/services/terrain-types.service");
const { syncSerialSequences } = require("../../integration-test-utils");

const uniqueName = (prefix) => `${prefix} ${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

describe("terrain-types service", () => {
  let fixture;
  let config;

  beforeAll(async () => {
    await syncSerialSequences(["TerrainTypeConfig", "TerrainType"]);
    config = await prisma.terrainTypeConfig.findFirst({ orderBy: { id: "asc" } });

    if (!config) {
      throw new Error("No se encontró una configuración de tipo de terreno base");
    }
  });

  beforeEach(async () => {
    fixture = await terrainTypesService.createTerrainType({
      name: uniqueName("Tipo IT"),
      terrainTypeConfigId: config.id,
    });
  });

  afterEach(async () => {
    if (!fixture) return;

    await prisma.terrainType.deleteMany({ where: { id: fixture.id } });
  });

  it("lists terrain types", async () => {
    const result = await terrainTypesService.listTerrainTypes({ page: 1, limit: 10 });
    expect(result.docs.some((terrainType) => terrainType.id === fixture.id)).toBe(true);
  });

  it("gets a terrain type by id", async () => {
    await expect(terrainTypesService.getTerrainTypeById(fixture.id)).resolves.toMatchObject({
      id: fixture.id,
      name: fixture.name,
    });
  });

  it("creates, updates and deletes a terrain type", async () => {
    const created = await terrainTypesService.createTerrainType({
      name: uniqueName("Tipo Nuevo"),
      terrainTypeConfigId: config.id,
    });

    try {
      const updated = await terrainTypesService.updateTerrainType(created.id, {
        name: uniqueName("Tipo Actualizado"),
        terrainTypeConfigId: config.id,
      });

      expect(updated.name).toContain("Tipo Actualizado");
      await expect(terrainTypesService.getTerrainTypeDeletePreview(created.id, 1)).resolves.toMatchObject({
        entityLabel: "tipo de terreno",
        canDelete: true,
      });

      await expect(terrainTypesService.deleteTerrainType(created.id, 1)).resolves.toBeUndefined();
    } finally {
      await prisma.terrainType.deleteMany({ where: { id: created.id } });
    }
  });

  it("rejects delete for read-only group", async () => {
    await expect(terrainTypesService.deleteTerrainType(fixture.id, 4)).rejects.toMatchObject({
      message: "No tienes permisos para eliminar tipos de terreno",
    });
  });
});

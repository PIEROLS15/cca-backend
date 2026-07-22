const prisma = require("../../../src/config/prisma");
const sectorsService = require("../../../src/api/sectors/services/sectors.service");
const { syncSerialSequences } = require("../../integration-test-utils");

const uniqueName = (prefix) => `${prefix} ${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

describe("sectors service", () => {
  let fixture;

  beforeAll(async () => {
    await syncSerialSequences(["Sector"]);
  });

  beforeEach(async () => {
    fixture = await sectorsService.createSector({ name: uniqueName("Sector IT") });
  });

  afterEach(async () => {
    if (!fixture) return;

    await prisma.sector.deleteMany({ where: { id: fixture.id } });
  });

  it("lists sectors", async () => {
    const result = await sectorsService.listSectors({ page: 1, limit: 10 });
    expect(result.docs.some((sector) => sector.id === fixture.id)).toBe(true);
  });

  it("gets a sector by id", async () => {
    await expect(sectorsService.getSectorById(fixture.id)).resolves.toMatchObject({
      id: fixture.id,
      name: fixture.name,
    });
  });

  it("creates, updates and deletes a sector", async () => {
    const created = await sectorsService.createSector({ name: uniqueName("Sector Nuevo") });
    const updated = await sectorsService.updateSector(created.id, { name: uniqueName("Sector Actualizado") });

    expect(updated.name).toContain("Sector Actualizado");
    await expect(sectorsService.getSectorDeletePreview(created.id, 1)).resolves.toMatchObject({
      entityLabel: "sector",
      canDelete: true,
    });

    await expect(sectorsService.deleteSector(created.id, 1)).resolves.toBeUndefined();
    await prisma.sector.deleteMany({ where: { id: created.id } });
  });

  it("rejects delete for read-only group", async () => {
    await expect(sectorsService.deleteSector(fixture.id, 4)).rejects.toMatchObject({ message: "No tienes permisos para eliminar sectores" });
  });
});

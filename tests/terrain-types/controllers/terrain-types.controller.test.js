const terrainTypesService = require("../../../src/api/terrain-types/services/terrain-types.service");
const apiResponse = require("../../../src/utils/api-response");

const mocks = {
  listTerrainTypes: vi.fn(),
  getTerrainTypeById: vi.fn(),
  getTerrainTypeDeletePreview: vi.fn(),
  createTerrainType: vi.fn(),
  updateTerrainType: vi.fn(),
  deleteTerrainType: vi.fn(),
  sendSuccess: vi.fn((res, payload) => res.status(payload.status || 200).json(payload)),
};

Object.assign(terrainTypesService, mocks);
apiResponse.sendSuccess = mocks.sendSuccess;

const terrainTypesController = require("../../../src/api/terrain-types/controllers/terrain-types.controller");

const createRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
  send: vi.fn(),
});

const runHandler = async (handler, req, res, next = vi.fn()) => {
  handler(req, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  return next;
};

describe("terrain-types controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists terrain types", async () => {
    mocks.listTerrainTypes.mockResolvedValue({ docs: [] });
    const res = createRes();

    await runHandler(terrainTypesController.listTerrainTypes, { query: {} }, res);

    expect(mocks.listTerrainTypes).toHaveBeenCalledWith({});
    expect(mocks.sendSuccess).toHaveBeenCalled();
  });

  it("gets a terrain type by id", async () => {
    mocks.getTerrainTypeById.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(terrainTypesController.getTerrainTypeById, { params: { id: "1" } }, res);

    expect(mocks.getTerrainTypeById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  it("returns a delete preview", async () => {
    mocks.getTerrainTypeDeletePreview.mockResolvedValue({ canDelete: true });
    const res = createRes();

    await runHandler(terrainTypesController.previewDeleteTerrainType, { params: { id: "1" }, user: { roleGroup: 1 } }, res);

    expect(mocks.getTerrainTypeDeletePreview).toHaveBeenCalledWith(1, 1);
    expect(res.json).toHaveBeenCalledWith({ canDelete: true });
  });

  it("creates a terrain type", async () => {
    mocks.createTerrainType.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(terrainTypesController.createTerrainType, { body: { name: "Lote" } }, res);

    expect(mocks.createTerrainType).toHaveBeenCalledWith({ name: "Lote" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updates a terrain type", async () => {
    mocks.updateTerrainType.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(terrainTypesController.updateTerrainType, { params: { id: "1" }, body: { name: "Lote" } }, res);

    expect(mocks.updateTerrainType).toHaveBeenCalledWith(1, { name: "Lote" });
  });

  it("deletes a terrain type", async () => {
    mocks.deleteTerrainType.mockResolvedValue(undefined);
    const res = createRes();

    await runHandler(terrainTypesController.deleteTerrainType, { params: { id: "1" }, user: { roleGroup: 1 } }, res);

    expect(mocks.deleteTerrainType).toHaveBeenCalledWith(1, 1);
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

const sectorsService = require("../../../src/api/sectors/services/sectors.service");
const apiResponse = require("../../../src/utils/api-response");

const mocks = {
  listSectors: vi.fn(),
  getSectorById: vi.fn(),
  getSectorDeletePreview: vi.fn(),
  createSector: vi.fn(),
  updateSector: vi.fn(),
  deleteSector: vi.fn(),
  sendSuccess: vi.fn((res, payload) => res.status(payload.status || 200).json(payload)),
};

Object.assign(sectorsService, mocks);
apiResponse.sendSuccess = mocks.sendSuccess;

const sectorsController = require("../../../src/api/sectors/controllers/sectors.controller");

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

describe("sectors controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists sectors", async () => {
    mocks.listSectors.mockResolvedValue({ docs: [] });
    const res = createRes();

    await runHandler(sectorsController.listSectors, { query: {} }, res);

    expect(mocks.listSectors).toHaveBeenCalledWith({});
    expect(mocks.sendSuccess).toHaveBeenCalled();
  });

  it("gets a sector by id", async () => {
    mocks.getSectorById.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(sectorsController.getSectorById, { params: { id: "1" } }, res);

    expect(mocks.getSectorById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  it("returns a delete preview", async () => {
    mocks.getSectorDeletePreview.mockResolvedValue({ canDelete: true });
    const res = createRes();

    await runHandler(sectorsController.previewDeleteSector, { params: { id: "1" }, user: { roleGroup: 1 } }, res);

    expect(mocks.getSectorDeletePreview).toHaveBeenCalledWith(1, 1);
    expect(res.json).toHaveBeenCalledWith({ canDelete: true });
  });

  it("creates a sector", async () => {
    mocks.createSector.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(sectorsController.createSector, { body: { name: "Sector 1" } }, res);

    expect(mocks.createSector).toHaveBeenCalledWith({ name: "Sector 1" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updates a sector", async () => {
    mocks.updateSector.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(sectorsController.updateSector, { params: { id: "1" }, body: { name: "Sector 1" } }, res);

    expect(mocks.updateSector).toHaveBeenCalledWith(1, { name: "Sector 1" });
  });

  it("deletes a sector", async () => {
    mocks.deleteSector.mockResolvedValue(undefined);
    const res = createRes();

    await runHandler(sectorsController.deleteSector, { params: { id: "1" }, user: { roleGroup: 1 } }, res);

    expect(mocks.deleteSector).toHaveBeenCalledWith(1, 1);
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

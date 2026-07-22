const rolesService = require("../../../src/api/roles/services/roles.service");
const apiResponse = require("../../../src/utils/api-response");

const mocks = {
  listRoles: vi.fn(),
  getRoleById: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  getRoleDeletePreview: vi.fn(),
  sendSuccess: vi.fn((res, payload) => res.status(payload.status || 200).json(payload)),
};

Object.assign(rolesService, mocks);
apiResponse.sendSuccess = mocks.sendSuccess;

const rolesController = require("../../../src/api/roles/controllers/roles.controller");

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

describe("roles controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists roles", async () => {
    mocks.listRoles.mockResolvedValue({ docs: [] });
    const req = { query: {} };
    const res = createRes();

    await runHandler(rolesController.listRoles, req, res);

    expect(mocks.listRoles).toHaveBeenCalledWith({});
    expect(mocks.sendSuccess).toHaveBeenCalled();
  });

  it("gets a role by id", async () => {
    mocks.getRoleById.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(rolesController.getRoleById, { params: { id: "1" } }, res);

    expect(mocks.getRoleById).toHaveBeenCalledWith(1);
    expect(mocks.sendSuccess).toHaveBeenCalled();
  });

  it("creates a role", async () => {
    mocks.createRole.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(rolesController.createRole, { body: { name: "Admin" } }, res);

    expect(mocks.createRole).toHaveBeenCalledWith({ name: "Admin" });
    expect(mocks.sendSuccess).toHaveBeenCalledWith(res, expect.objectContaining({ status: 201 }));
  });

  it("updates a role", async () => {
    mocks.updateRole.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(rolesController.updateRole, { params: { id: "1" }, body: { name: "Nuevo" } }, res);

    expect(mocks.updateRole).toHaveBeenCalledWith(1, { name: "Nuevo" });
  });

  it("deletes a role", async () => {
    mocks.deleteRole.mockResolvedValue(undefined);
    const res = createRes();

    await runHandler(rolesController.deleteRole, { params: { id: "1" } }, res);

    expect(mocks.deleteRole).toHaveBeenCalledWith(1);
    expect(mocks.sendSuccess).toHaveBeenCalledWith(res, expect.objectContaining({ data: null }));
  });

  it("returns a delete preview", async () => {
    mocks.getRoleDeletePreview.mockResolvedValue({ canDelete: true });
    const res = createRes();

    await runHandler(rolesController.previewDeleteRole, { params: { id: "1" } }, res);

    expect(mocks.getRoleDeletePreview).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ canDelete: true });
  });
});

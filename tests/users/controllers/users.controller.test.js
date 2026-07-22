const usersService = require("../../../src/api/users/services/users.service");
const apiResponse = require("../../../src/utils/api-response");
const mocks = {
  listUsers: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  updateUserStatus: vi.fn(),
  deleteUser: vi.fn(),
  sendSuccess: vi.fn((res, payload) => res.status(payload.status || 200).json(payload)),
};

Object.assign(usersService, mocks);
apiResponse.sendSuccess = mocks.sendSuccess;

const usersController = require("../../../src/api/users/controllers/users.controller");

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

describe("users controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists users", async () => {
    mocks.listUsers.mockResolvedValue({ docs: [] });
    const req = { query: {} };
    const res = createRes();

    await runHandler(usersController.listUsers, req, res);

    expect(mocks.listUsers).toHaveBeenCalledWith({});
    expect(mocks.sendSuccess).toHaveBeenCalled();
  });

  it("gets a user by id", async () => {
    mocks.getUserById.mockResolvedValue({ id: 1 });
    const req = { params: { id: "1" } };
    const res = createRes();

    await runHandler(usersController.getUserById, req, res);

    expect(mocks.getUserById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  it("creates a user", async () => {
    mocks.createUser.mockResolvedValue({ id: 1 });
    const req = {
      body: {
        username: "user",
        password: "Test1234!",
        fullName: "Usuario",
        email: "user@example.com",
        dni: "12345678",
        roleId: "2",
      },
      user: { role: { name: "Admin" } },
    };
    const res = createRes();

    await runHandler(usersController.createUser, req, res);

    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ roleId: 2 }), { name: "Admin" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updates a user", async () => {
    mocks.updateUser.mockResolvedValue({ id: 1 });
    const req = {
      params: { id: "1" },
      body: { fullName: "Nuevo", roleId: "3" },
      user: { role: { name: "Admin" } },
    };
    const res = createRes();

    await runHandler(usersController.updateUser, req, res);

    expect(mocks.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ roleId: 3 }), { name: "Admin" });
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  it("updates a user status", async () => {
    mocks.updateUserStatus.mockResolvedValue({ id: 1, isActive: false });
    const req = {
      params: { id: "1" },
      body: { isActive: false },
      user: { role: { name: "Admin" } },
    };
    const res = createRes();

    await runHandler(usersController.updateUserStatus, req, res);

    expect(mocks.updateUserStatus).toHaveBeenCalledWith(1, false, { name: "Admin" });
    expect(res.json).toHaveBeenCalledWith({ id: 1, isActive: false });
  });

  it("deletes a user", async () => {
    mocks.deleteUser.mockResolvedValue(undefined);
    const req = { params: { id: "1" }, user: { role: { name: "Admin" } } };
    const res = createRes();

    await runHandler(usersController.deleteUser, req, res);

    expect(mocks.deleteUser).toHaveBeenCalledWith(1, { name: "Admin" });
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

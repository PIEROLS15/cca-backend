const clientsService = require("../../../src/api/clients/services/clients.service");
const reniecService = require("../../../src/api/clients/services/reniec.service");
const apiResponse = require("../../../src/utils/api-response");

const mocks = {
  listClients: vi.fn(),
  getClientById: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  getClientDeletePreview: vi.fn(),
  searchByDocument: vi.fn(),
  searchReniec: vi.fn(),
  sendSuccess: vi.fn((res, payload) => res.status(payload.status || 200).json(payload)),
};

Object.assign(clientsService, mocks);
Object.assign(reniecService, { searchByDocument: mocks.searchReniec });
apiResponse.sendSuccess = mocks.sendSuccess;

const clientsController = require("../../../src/api/clients/controllers/clients.controller");

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

describe("clients controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists clients", async () => {
    mocks.listClients.mockResolvedValue({ docs: [] });
    const res = createRes();

    await runHandler(clientsController.listClients, { query: {} }, res);

    expect(mocks.listClients).toHaveBeenCalledWith({
      clientType: undefined,
      page: undefined,
      limit: undefined,
      search: undefined,
      documentNumber: undefined,
    });
    expect(mocks.sendSuccess).toHaveBeenCalled();
  });

  it("gets a client by id", async () => {
    mocks.getClientById.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(clientsController.getClientById, { params: { id: "1" } }, res);

    expect(mocks.getClientById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  it("creates a client", async () => {
    mocks.createClient.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(clientsController.createClient, {
      body: { fullName: "Juan", documentNumber: "12345678", isComunero: true },
      user: { role: { name: "Admin" } },
    }, res);

    expect(mocks.createClient).toHaveBeenCalledWith(expect.objectContaining({ isComunero: true, noDocument: false }), { name: "Admin" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updates a client", async () => {
    mocks.updateClient.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(clientsController.updateClient, {
      params: { id: "1" },
      body: { fullName: "Juan", documentNumber: "12345678", isComunero: false },
      user: { role: { name: "Admin" } },
    }, res);

    expect(mocks.updateClient).toHaveBeenCalledWith(1, expect.objectContaining({ isComunero: false, noDocument: false }), { name: "Admin" });
  });

  it("deletes a client", async () => {
    mocks.deleteClient.mockResolvedValue(undefined);
    const res = createRes();

    await runHandler(clientsController.deleteClient, { params: { id: "1" } }, res);

    expect(mocks.deleteClient).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("returns a client delete preview", async () => {
    mocks.getClientDeletePreview.mockResolvedValue({ canDelete: true });
    const res = createRes();

    await runHandler(clientsController.previewDeleteClient, { params: { id: "1" } }, res);

    expect(mocks.getClientDeletePreview).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ canDelete: true });
  });

  it("searches by document", async () => {
    mocks.searchByDocument.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(clientsController.searchByDocument, { params: { document: "123" } }, res);

    expect(mocks.searchByDocument).toHaveBeenCalledWith("123");
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  it("searches reniec", async () => {
    mocks.searchReniec.mockResolvedValue({ fullName: "Juan" });
    const res = createRes();

    await runHandler(clientsController.searchReniec, { params: { document: "12345678" } }, res);

    expect(mocks.searchReniec).toHaveBeenCalledWith("12345678");
    expect(res.json).toHaveBeenCalledWith({ fullName: "Juan" });
  });
});

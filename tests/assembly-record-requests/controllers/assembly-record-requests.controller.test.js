const assemblyRecordRequestsService = require("../../../src/api/assembly-record-requests/services/assembly-record-requests.service");
const pdfUtils = require("../../../src/api/assembly-record-requests/utils/assembly-record-requests-pdf.utils");
const apiResponse = require("../../../src/utils/api-response");

const mocks = {
  listAssemblyRecordRequests: vi.fn(),
  getAssemblyRecordRequestById: vi.fn(),
  createAssemblyRecordRequest: vi.fn(),
  updateAssemblyRecordRequest: vi.fn(),
  deleteAssemblyRecordRequest: vi.fn(),
  getAssemblyRecordRequestDeletePreview: vi.fn(),
  getAssemblyRecordRequestByCode: vi.fn(),
  buildAssemblyRecordRequestPdf: vi.fn(),
  sendSuccess: vi.fn((res, payload) => res.status(payload.status || 200).json(payload)),
};

Object.assign(assemblyRecordRequestsService, mocks);
pdfUtils.buildAssemblyRecordRequestPdf = mocks.buildAssemblyRecordRequestPdf;
apiResponse.sendSuccess = mocks.sendSuccess;

const controller = require("../../../src/api/assembly-record-requests/controllers/assembly-record-requests.controller");

const createRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
  send: vi.fn(),
  setHeader: vi.fn(),
});

const runHandler = async (handler, req, res, next = vi.fn()) => {
  handler(req, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  return next;
};

describe("assembly-record-requests controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists requests", async () => {
    mocks.listAssemblyRecordRequests.mockResolvedValue({ docs: [] });
    const res = createRes();

    await runHandler(controller.listAssemblyRecordRequests, { query: {} }, res);

    expect(mocks.listAssemblyRecordRequests).toHaveBeenCalledWith({ page: undefined, limit: undefined, search: undefined });
    expect(mocks.sendSuccess).toHaveBeenCalled();
  });

  it("gets a request by id", async () => {
    mocks.getAssemblyRecordRequestById.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(controller.getAssemblyRecordRequestById, { params: { id: "1" } }, res);

    expect(mocks.getAssemblyRecordRequestById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  it("creates a request", async () => {
    mocks.createAssemblyRecordRequest.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(controller.createAssemblyRecordRequest, {
      body: { clientId: 1, certificateId: 2 },
      user: { sub: 9 },
    }, res);

    expect(mocks.createAssemblyRecordRequest).toHaveBeenCalledWith(expect.objectContaining({ clientId: 1, certificateId: 2 }), 9);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updates a request", async () => {
    mocks.updateAssemblyRecordRequest.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(controller.updateAssemblyRecordRequest, { params: { id: "1" }, body: {}, user: { sub: 9 } }, res);

    expect(mocks.updateAssemblyRecordRequest).toHaveBeenCalledWith(1, {}, 9);
  });

  it("deletes a request", async () => {
    mocks.deleteAssemblyRecordRequest.mockResolvedValue(undefined);
    const res = createRes();

    await runHandler(controller.deleteAssemblyRecordRequest, { params: { id: "1" } }, res);

    expect(mocks.deleteAssemblyRecordRequest).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("builds a preview", async () => {
    mocks.getAssemblyRecordRequestById.mockResolvedValue({
      code: "SOL-ACTA-1",
      client: { fullName: "Juan" },
      certificate: { certificateNumber: "ABC" },
    });
    const res = createRes();

    await runHandler(controller.previewAssemblyRecordRequest, { params: { id: "1" } }, res);

    expect(res.json).toHaveBeenCalledWith({
      code: "SOL-ACTA-1",
      client: "Juan",
      certificateNumber: "ABC",
      preview: "Solicitud SOL-ACTA-1 basada en certificado ABC",
    });
  });

  it("returns a delete preview", async () => {
    mocks.getAssemblyRecordRequestDeletePreview.mockResolvedValue({ canDelete: true });
    const res = createRes();

    await runHandler(controller.previewDeleteAssemblyRecordRequest, { params: { id: "1" } }, res);

    expect(mocks.getAssemblyRecordRequestDeletePreview).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ canDelete: true });
  });

  it("downloads a request pdf", async () => {
    mocks.getAssemblyRecordRequestById.mockResolvedValue({ code: "SOL-ACTA-1" });
    mocks.buildAssemblyRecordRequestPdf.mockResolvedValue(Buffer.from("pdf"));
    const res = createRes();

    await runHandler(controller.downloadAssemblyRecordRequestPdf, { params: { id: "1" } }, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it("downloads a request pdf by filename", async () => {
    mocks.getAssemblyRecordRequestByCode.mockResolvedValue({ code: "SOL-ACTA-1" });
    mocks.buildAssemblyRecordRequestPdf.mockResolvedValue(Buffer.from("pdf"));
    const res = createRes();

    await runHandler(controller.downloadAssemblyRecordRequestPdfByFilename, { params: { filename: "solicitud-acta-SOL-ACTA-1.pdf" } }, res);

    expect(mocks.getAssemblyRecordRequestByCode).toHaveBeenCalledWith("SOL-ACTA-1");
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });
});

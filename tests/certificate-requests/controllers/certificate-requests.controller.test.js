const certificateRequestsService = require("../../../src/api/certificate-requests/services/certificate-requests.service");
const pdfUtils = require("../../../src/api/certificate-requests/utils/certificate-requests-pdf.utils");
const apiResponse = require("../../../src/utils/api-response");

const mocks = {
  listCertificateRequests: vi.fn(),
  getCertificateRequestById: vi.fn(),
  createCertificateRequest: vi.fn(),
  updateCertificateRequest: vi.fn(),
  deleteCertificateRequest: vi.fn(),
  getCertificateRequestDeletePreview: vi.fn(),
  buildCertificateRequestPdf: vi.fn(),
  sendSuccess: vi.fn((res, payload) => res.status(payload.status || 200).json(payload)),
};

Object.assign(certificateRequestsService, mocks);
pdfUtils.buildCertificateRequestPdf = mocks.buildCertificateRequestPdf;
apiResponse.sendSuccess = mocks.sendSuccess;

const controller = require("../../../src/api/certificate-requests/controllers/certificate-requests.controller");

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

describe("certificate-requests controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists requests", async () => {
    mocks.listCertificateRequests.mockResolvedValue({ docs: [] });
    const res = createRes();

    await runHandler(controller.listCertificateRequests, { query: {} }, res);

    expect(mocks.listCertificateRequests).toHaveBeenCalledWith({ page: undefined, limit: undefined, search: undefined });
    expect(mocks.sendSuccess).toHaveBeenCalled();
  });

  it("gets a request by id", async () => {
    mocks.getCertificateRequestById.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(controller.getCertificateRequestById, { params: { id: 1 } }, res);

    expect(mocks.getCertificateRequestById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  it("creates a request", async () => {
    mocks.createCertificateRequest.mockResolvedValue({ id: 1 });
    const res = createRes();
    const body = { client: { documentNumber: "123", fullName: "Juan" } };

    await runHandler(controller.createCertificateRequest, { body, user: { sub: 7 } }, res);

    expect(mocks.createCertificateRequest).toHaveBeenCalledWith(body, 7);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updates a request", async () => {
    mocks.updateCertificateRequest.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(controller.updateCertificateRequest, { params: { id: 1 }, body: {}, user: { sub: 7 } }, res);

    expect(mocks.updateCertificateRequest).toHaveBeenCalledWith(1, {}, 7);
  });

  it("deletes a request", async () => {
    mocks.deleteCertificateRequest.mockResolvedValue(undefined);
    const res = createRes();

    await runHandler(controller.deleteCertificateRequest, { params: { id: 1 } }, res);

    expect(mocks.deleteCertificateRequest).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("returns a delete preview", async () => {
    mocks.getCertificateRequestDeletePreview.mockResolvedValue({ canDelete: true });
    const res = createRes();

    await runHandler(controller.previewDeleteCertificateRequest, { params: { id: 1 } }, res);

    expect(mocks.getCertificateRequestDeletePreview).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ canDelete: true });
  });

  it("downloads a request pdf", async () => {
    mocks.getCertificateRequestById.mockResolvedValue({ requestNumber: "123" });
    mocks.buildCertificateRequestPdf.mockResolvedValue(Buffer.from("pdf"));
    const res = createRes();

    await runHandler(controller.downloadCertificateRequestPdf, { params: { filename: "solicitud-certificado-123.pdf" } }, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });
});

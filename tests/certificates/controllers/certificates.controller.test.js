const certificatesService = require("../../../src/api/certificates/services/certificates.service");
const certificatesPdfUtils = require("../../../src/api/certificates/utils/certificates-pdf.utils");

const mocks = {
  listCertificates: vi.fn(),
  getCertificateById: vi.fn(),
  createCertificate: vi.fn(),
  updateCertificate: vi.fn(),
  deleteCertificate: vi.fn(),
  getCertificateDeletePreview: vi.fn(),
  getCertificateByNumber: vi.fn(),
  buildCertificatePdf: vi.fn(),
};

Object.assign(certificatesService, mocks);
certificatesPdfUtils.buildCertificatePdf = mocks.buildCertificatePdf;

const certificatesController = require("../../../src/api/certificates/controllers/certificates.controller");

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

describe("certificates controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists certificates", async () => {
    mocks.listCertificates.mockResolvedValue({ docs: [] });
    const res = createRes();

    await runHandler(certificatesController.listCertificates, { query: {} }, res);

    expect(mocks.listCertificates).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("gets a certificate by id", async () => {
    mocks.getCertificateById.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(certificatesController.getCertificateById, { params: { id: "1" } }, res);

    expect(mocks.getCertificateById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  it("creates a certificate", async () => {
    mocks.createCertificate.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(certificatesController.createCertificate, { body: { owners: [{}] }, user: { sub: 1 } }, res);

    expect(mocks.createCertificate).toHaveBeenCalledWith({ owners: [{}] }, 1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updates a certificate", async () => {
    mocks.updateCertificate.mockResolvedValue({ id: 1 });
    const res = createRes();

    await runHandler(certificatesController.updateCertificate, { params: { id: "1" }, body: {}, user: { sub: 1 } }, res);

    expect(mocks.updateCertificate).toHaveBeenCalledWith(1, {}, 1);
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  it("deletes a certificate", async () => {
    mocks.deleteCertificate.mockResolvedValue(undefined);
    const res = createRes();

    await runHandler(certificatesController.deleteCertificate, { params: { id: "1" } }, res);

    expect(mocks.deleteCertificate).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("returns a delete preview", async () => {
    mocks.getCertificateDeletePreview.mockResolvedValue({ canDelete: true });
    const res = createRes();

    await runHandler(certificatesController.previewDeleteCertificate, { params: { id: "1" } }, res);

    expect(mocks.getCertificateDeletePreview).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ canDelete: true });
  });

  it("downloads a certificate pdf", async () => {
    mocks.getCertificateById.mockResolvedValue({ id: 1, certificateNumber: "123", owners: [] });
    mocks.buildCertificatePdf.mockResolvedValue(Buffer.from("pdf"));
    const res = createRes();

    await runHandler(certificatesController.downloadCertificatePdf, { params: { id: "1" } }, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it("downloads a certificate pdf by filename", async () => {
    mocks.getCertificateByNumber.mockResolvedValue({ certificateNumber: "123" });
    mocks.buildCertificatePdf.mockResolvedValue(Buffer.from("pdf"));
    const res = createRes();

    await runHandler(certificatesController.downloadCertificatePdfByFilename, { params: { filename: "certificado-123.pdf" } }, res);

    expect(mocks.getCertificateByNumber).toHaveBeenCalledWith("123");
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it("looks up a certificate by number", async () => {
    mocks.getCertificateByNumber.mockResolvedValue({ certificateNumber: "123" });
    const res = createRes();

    await runHandler(certificatesController.lookupCertificateByNumber, { params: { number: "123" } }, res);

    expect(mocks.getCertificateByNumber).toHaveBeenCalledWith("123");
    expect(res.json).toHaveBeenCalledWith({ certificateNumber: "123" });
  });
});

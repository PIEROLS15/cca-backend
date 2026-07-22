const certificatesService = require("../../../src/api/certificates/services/certificates.service");
const documentTrackingService = require("../../../src/api/public/services/document-tracking.service");
const apiResponse = require("../../../src/utils/api-response");

const mocks = {
  getCertificateVerificationByToken: vi.fn(),
  getDocumentTrackingByTypeAndCode: vi.fn(),
  sendSuccess: vi.fn((res, payload) => res.status(payload.status || 200).json(payload)),
};

Object.assign(certificatesService, mocks);
Object.assign(documentTrackingService, mocks);
apiResponse.sendSuccess = mocks.sendSuccess;

const controller = require("../../../src/api/public/controllers/public.controller");

const createRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
});

const runHandler = async (handler, req, res, next = vi.fn()) => {
  handler(req, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  return next;
};

describe("public controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies a certificate", async () => {
    mocks.getCertificateVerificationByToken.mockResolvedValue({ certificate: { certificateNumber: "001" } });
    const res = createRes();

    await runHandler(controller.verifyCertificate, { params: { token: "abc" } }, res);

    expect(mocks.getCertificateVerificationByToken).toHaveBeenCalledWith("abc");
    expect(mocks.sendSuccess).toHaveBeenCalled();
  });

  it("tracks a document", async () => {
    mocks.getDocumentTrackingByTypeAndCode.mockResolvedValue({ code: "001" });
    const res = createRes();

    await runHandler(controller.trackDocument, { params: { documentType: "certificate", code: "001" } }, res);

    expect(mocks.getDocumentTrackingByTypeAndCode).toHaveBeenCalledWith("certificate", "001");
    expect(mocks.sendSuccess).toHaveBeenCalled();
  });
});

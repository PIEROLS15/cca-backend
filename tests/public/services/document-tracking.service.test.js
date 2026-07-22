const prisma = require("../../../src/config/prisma");
const documentTrackingService = require("../../../src/api/public/services/document-tracking.service");

describe("document tracking service", () => {
  let certificate;
  let certificateRequest;

  beforeAll(async () => {
    [certificate, certificateRequest] = await Promise.all([
      prisma.certificate.findFirst({ orderBy: { id: "asc" } }),
      prisma.certificateRequest.findFirst({ orderBy: { id: "asc" } }),
    ]);
  });

  it("tracks a certificate request", async () => {
    await expect(documentTrackingService.getDocumentTrackingByTypeAndCode("solicitud de certificado", certificateRequest.requestNumber)).resolves.toMatchObject({
      code: certificateRequest.requestNumber,
    });
  });

  it("tracks a certificate", async () => {
    await expect(documentTrackingService.getDocumentTrackingByTypeAndCode("certificado", certificate.certificateNumber)).resolves.toMatchObject({
      code: certificate.certificateNumber,
    });
  });
});

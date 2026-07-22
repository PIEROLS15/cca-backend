const { buildCertificateRequestPdf } = require("../../../src/api/certificate-requests/utils/certificate-requests-pdf.utils");
const { createCertificateRequestFixture, removeCertificateRequestFixture } = require("../certificate-requests.test-utils");

describe("certificate-requests pdf utils", () => {
  let fixture;

  beforeAll(async () => {
    fixture = await createCertificateRequestFixture({
      requestNumber: `IT-CR-PDF-${Date.now()}`,
      destination: "Secretaria",
      certificateTypes: [{ type: "CertificadoPosesion" }],
      attachments: [{ type: "CopiaDni" }, { type: "Celular", phoneNumber: "999999999" }],
    });
  });

  afterAll(async () => {
    await removeCertificateRequestFixture(fixture);
  });

  it("builds a real pdf buffer", async () => {
    const buffer = await buildCertificateRequestPdf(fixture.request);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

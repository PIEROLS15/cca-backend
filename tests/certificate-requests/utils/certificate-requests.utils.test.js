const {
  buildRequestNumber,
  formatCertificateRequestResponse,
  normalizeCertificateRequestStatus,
  formatCertificateRequestStatus,
} = require("../../../src/api/certificate-requests/utils/certificate-requests.utils");
const { createCertificateRequestFixture, removeCertificateRequestFixture } = require("../certificate-requests.test-utils");

describe("certificate-requests utils", () => {
  let fixture;

  beforeAll(async () => {
    fixture = await createCertificateRequestFixture({
      requestNumber: `IT-CR-UTIL-${Date.now()}`,
      destination: "Secretaria",
      certificateTypes: [{ type: "CertificadoPosesion" }],
      attachments: [{ type: "CopiaDni" }],
    });
  });

  afterAll(async () => {
    await removeCertificateRequestFixture(fixture);
  });

  it("builds request numbers", () => {
    expect(buildRequestNumber(7, new Date("2024-01-01T00:00:00.000Z"))).toBe("000007-23");
  });

  it("normalizes statuses", () => {
    expect(normalizeCertificateRequestStatus("Por Firmar")).toBe("PorFirmar");
    expect(formatCertificateRequestStatus("PorRecoger")).toBe("Por Recoger");
  });

  it("formats real request data", () => {
    expect(formatCertificateRequestResponse(fixture.request)).toMatchObject({
      id: fixture.request.id,
      requestNumber: fixture.request.requestNumber,
      client: {
        id: fixture.client.id,
        fullName: fixture.client.fullName,
      },
      status: "Recepcionado",
    });
  });
});

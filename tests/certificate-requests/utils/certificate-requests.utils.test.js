const {
  buildRequestNumber,
  formatCertificateRequestResponse,
  normalizeCertificateRequestStatus,
  formatCertificateRequestStatus,
  normalizeCertificateTypes,
  normalizeAttachments,
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
    expect(buildRequestNumber(7, new Date("2023-01-01T00:00:00.000Z"))).toMatch(/^000007-\d{2}$/);
  });

  it("normalizes statuses", () => {
    expect(normalizeCertificateRequestStatus("Por Firmar")).toBe("PorFirmar");
    expect(formatCertificateRequestStatus("PorRecoger")).toBe("Por Recoger");
  });

  it("normalizes certificate types and attachments", () => {
    expect(normalizeCertificateTypes([{ type: "Certificado de posesion" }, { type: "Otros", otherType: "Plano" }], { type: ["Plano y memoria"], otherType: "Adjunto" })).toEqual([
      { type: "CertificadoPosesion" },
      { type: "Otros", otherType: "Plano" },
      { type: "PlanoMemoria" },
    ]);

    expect(normalizeAttachments([{ type: "Copia DNI" }, { type: "Celular 999888777" }], { attachment: ["Constancia de adjudicacion"], phoneNumber: "123456789" })).toEqual([
      { type: "CopiaDni" },
      { type: "Celular", phoneNumber: "999888777" },
      { type: "ConstanciaAdjudicacion" },
    ]);
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

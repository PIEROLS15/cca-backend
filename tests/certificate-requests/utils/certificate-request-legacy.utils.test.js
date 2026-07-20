const {
  normalizeComparableText,
  normalizeRequestDestination,
  normalizeCertificateTypes,
  normalizeAttachments,
  extractPhoneNumber,
  normalizeCertificateTypeLabel,
  normalizeAttachmentLabel,
} = require("../../../src/api/certificate-requests/utils/certificate-request-legacy.utils");
const { createCertificateRequestFixture, removeCertificateRequestFixture } = require("../certificate-requests.test-utils");

describe("certificate-request legacy utils", () => {
  let fixture;

  beforeAll(async () => {
    fixture = await createCertificateRequestFixture({
      requestNumber: `IT-CR-LEGACY-${Date.now()}`,
      destination: "Secretaria",
      requestDescription: "Solicitud de prueba",
      certificateTypes: [{ type: "CertificadoPosesion" }, { type: "Otros", otherType: "Plano" }],
      attachments: [{ type: "CopiaDni" }, { type: "Celular", phoneNumber: "999999999" }],
      legacyPayload: { destination: "Secretaria" },
    });
  });

  afterAll(async () => {
    await removeCertificateRequestFixture(fixture);
  });

  it("normalizes comparable text", () => {
    expect(normalizeComparableText("  Señalización-01 ")).toBe("senalizacion01");
  });

  it("normalizes destinations from real data", () => {
    expect(normalizeRequestDestination(fixture.request.destination, fixture.request.legacyPayload?.destination)).toBe("Secretaria");
  });

  it("normalizes certificate types from real data", () => {
    expect(normalizeCertificateTypes(fixture.request.certificateTypes, fixture.request.legacyPayload)).toEqual([
      { type: "CertificadoPosesion" },
      { type: "Otros", otherType: "Plano" },
    ]);
  });

  it("normalizes certificate type labels", () => {
    expect(normalizeCertificateTypeLabel("Certificado de posesion")).toEqual({ type: "CertificadoPosesion" });
    expect(normalizeCertificateTypeLabel("Otros", "Plano")).toEqual({ type: "Otros", otherType: "Plano" });
  });

  it("normalizes attachments from real data", () => {
    expect(normalizeAttachments(fixture.request.attachments, fixture.request.legacyPayload)).toEqual([
      { type: "CopiaDni" },
      { type: "Celular", phoneNumber: "999999999" },
    ]);
  });

  it("normalizes attachment labels and extracts phone numbers", () => {
    expect(normalizeAttachmentLabel("Copia de DNI")).toBe("CopiaDni");
    expect(extractPhoneNumber("Celular 987654321")).toBe("987654321");
  });
});

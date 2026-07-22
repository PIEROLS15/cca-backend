const {
  buildCertificateVerificationPayload,
  buildCertificateVerificationUrl,
} = require("../../../src/api/certificates/utils/certificate-verification.utils");

describe("certificate verification utils", () => {
  it("builds a verification payload", () => {
    const payload = buildCertificateVerificationPayload({
      verificationToken: "abc",
      certificateNumber: "001",
      owners: [{ fullName: "Juan", documentNumber: "123" }],
      terrain: { terrainType: { name: "Lote" }, width: 10 },
      location: { sectors: { name: "Sector" }, mz: "A", lot: "1" },
      borders: { north: "N" },
      additionalNotes: "Nota",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    expect(payload.verificationToken).toBe("abc");
    expect(payload.certificate.certificateNumber).toBe("001");
  });

  it("builds a verification url", () => {
    process.env.FRONTEND_URL = "https://front.test/";
    expect(buildCertificateVerificationUrl("abc 123")).toBe("https://front.test/verificar-certificado/abc%20123");
  });
});

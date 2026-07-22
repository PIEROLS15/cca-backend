const {
  DOCUMENT_TYPE_CONFIG,
  formatCertificateRequestTypes,
  formatDateInLima,
  buildTrackingResponse,
} = require("../../../src/api/public/utils/document-tracking.utils");

describe("document tracking utils", () => {
  it("exposes document type config", () => {
    expect(DOCUMENT_TYPE_CONFIG.certificate.label).toBe("Certificado");
  });

  it("formats certificate request types", () => {
    expect(formatCertificateRequestTypes([{ type: "Certificado de posesion" }, { type: "Otros", otherType: "X" }])).toBe("Certificado de posesión, X");
  });

  it("formats dates in Lima", () => {
    expect(formatDateInLima("2024-01-02T00:00:00.000Z")).toBe("02/01/2024");
  });

  it("builds tracking responses", () => {
    const response = buildTrackingResponse({
      documentType: "certificate",
      code: "001",
      currentStatus: "Recepcionado",
      createdAt: "2024-01-01T00:00:00.000Z",
      information: { people: [{ fullName: "Juan" }], fields: [{ value: "X" }] },
      historyRows: [],
    });

    expect(response.documentType).toBe("certificate");
    expect(response.history.length).toBeGreaterThan(0);
  });
});

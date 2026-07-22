const {
  normalizeCertificateStatus,
  normalizeTerrainMeasurementMode,
  deriveTerrainMeasurementMode,
  formatCertificateStatus,
  formatCertificateResponse,
  buildCertificateFilters,
} = require("../../../src/api/certificates/utils/certificates.utils");

describe("certificates utils", () => {
  it("normalizes and formats statuses", () => {
    expect(normalizeCertificateStatus("Por Firmar")).toBe("PorFirmar");
    expect(formatCertificateStatus("PorFirmar")).toBe("Por Firmar");
  });

  it("handles terrain measurement modes", () => {
    expect(normalizeTerrainMeasurementMode("AREA_PERIMETER")).toBe("AREA_PERIMETER");
    expect(deriveTerrainMeasurementMode({ area: 1, perimeter: 2 })).toBe("AREA_PERIMETER");
  });

  it("formats a certificate response", () => {
    const response = formatCertificateResponse({
      id: 1,
      certificateNumber: "001",
      status: "PorFirmar",
      owners: [{ client: { id: 1, fullName: "Juan", documentNumber: "123" }, order: 1 }],
      terrainType: { id: 2, name: "Lote", terrainTypeConfigId: 3, config: { id: 4, key: "x" } },
      sector: { id: 5, name: "Sector" },
      user: { dni: "123", role: { name: "Admin" } },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(response).toMatchObject({
      id: 1,
      certificateNumber: "001",
      status: "Por Firmar",
      owners: [{ id: 1, fullName: "Juan" }],
    });
  });

  it("builds filters", () => {
    const filters = buildCertificateFilters({
      certificateNumber: "001",
      status: "Por Firmar",
      sectorId: "2",
      search: "juan",
    });

    expect(filters.certificateNumber).toEqual({ contains: "001" });
    expect(filters.status).toBe("PorFirmar");
    expect(filters.sectorId).toBe(2);
    expect(filters.AND).toBeDefined();
  });
});

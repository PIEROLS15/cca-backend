const XLSX = require("xlsx");
const { buildCertificatesWorkbook } = require("../../../src/api/reports/utils/reports.utils");

describe("reports utils", () => {
  it("builds a certificates workbook", () => {
    const buffer = buildCertificatesWorkbook([
      {
        certificateNumber: "001",
        owners: [{ client: { fullName: "Juan", documentNumber: "123" } }],
        sector: { name: "Sector" },
        terrainType: { name: "Lote" },
        mz: "A",
        lot: "1",
        createdAt: new Date("2024-01-01T10:00:00.000Z"),
        status: "Entregado",
      },
    ]);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    expect(sheet.A1.v).toBe("Código Cert.");
    expect(sheet.A2.v).toBe(1);
  });
});

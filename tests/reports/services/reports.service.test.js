const reportsService = require("../../../src/api/reports/services/reports.service");

describe("reports service", () => {
  it("exports a certificates workbook", async () => {
    const buffer = await reportsService.exportCertificatesReport({});
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  }, 30000);
});

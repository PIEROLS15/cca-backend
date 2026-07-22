const reportsService = require("../../../src/api/reports/services/reports.service");

const mocks = {
  exportCertificatesReport: vi.fn(),
};

Object.assign(reportsService, mocks);

const controller = require("../../../src/api/reports/controllers/reports.controller");

const createRes = () => ({
  setHeader: vi.fn(),
  send: vi.fn(),
});

const runHandler = async (handler, req, res, next = vi.fn()) => {
  handler(req, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  return next;
};

describe("reports controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports certificates report", async () => {
    mocks.exportCertificatesReport.mockResolvedValue(Buffer.from("xlsx"));
    const res = createRes();

    await runHandler(controller.exportCertificatesReport, { query: {} }, res);

    expect(mocks.exportCertificatesReport).toHaveBeenCalledWith({});
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });
});

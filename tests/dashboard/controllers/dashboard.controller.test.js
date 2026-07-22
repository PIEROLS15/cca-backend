const dashboardService = require("../../../src/api/dashboard/services/dashboard.service");
const controller = require("../../../src/api/dashboard/controllers/dashboard.controller");

const mocks = {
  getSummary: vi.fn(),
  getStatusBreakdown: vi.fn(),
  getMonthlyActivity: vi.fn(),
  getRecentActivity: vi.fn(),
};

Object.assign(dashboardService, mocks);

const createRes = () => ({
  json: vi.fn(),
});

const runHandler = async (handler, req, res, next = vi.fn()) => {
  handler(req, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  return next;
};

describe("dashboard controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a summary", async () => {
    mocks.getSummary.mockResolvedValue({ certificates: 1 });
    const res = createRes();

    await runHandler(controller.getSummary, { query: {} }, res);

    expect(mocks.getSummary).toHaveBeenCalledWith();
    expect(res.json).toHaveBeenCalledWith({ certificates: 1 });
  });

  it("returns status breakdown", async () => {
    mocks.getStatusBreakdown.mockResolvedValue([]);
    const res = createRes();

    await runHandler(controller.getStatusBreakdown, { query: { from: "2024-01-01", to: "2024-01-31" } }, res);

    expect(mocks.getStatusBreakdown).toHaveBeenCalledWith({
      from: new Date("2024-01-01T00:00:00.000Z"),
      to: new Date("2024-01-31T23:59:59.999Z"),
    });
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("returns monthly activity", async () => {
    mocks.getMonthlyActivity.mockResolvedValue([]);
    const res = createRes();

    await runHandler(controller.getMonthlyActivity, { query: {} }, res);

    expect(mocks.getMonthlyActivity).toHaveBeenCalledWith({ from: undefined, to: undefined });
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("returns recent activity", async () => {
    mocks.getRecentActivity.mockResolvedValue([]);
    const res = createRes();

    await runHandler(controller.getRecentActivity, { query: {} }, res);

    expect(mocks.getRecentActivity).toHaveBeenCalledWith();
    expect(res.json).toHaveBeenCalledWith([]);
  });
});
